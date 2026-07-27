import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const MAX_TEXT_BLOB_BYTES = 2 * 1024 * 1024;

function git(args, input) {
  const result = spawnSync("git", args, {
    cwd: root,
    input,
    maxBuffer: 512 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isEnvironmentFile(relativePath) {
  const base = path.posix.basename(normalize(relativePath));
  return base === ".env" || (base.startsWith(".env.") && !base.endsWith(".example"));
}

const forbiddenPathRules = [
  ["production-infrastructure", (file) => /^infra\/production(?:\/|$)/i.test(file)],
  ["private-workspace-control-plane", (file) => /^frontend\/src\/workspace(?:\/|$)/i.test(file)],
  ["private-platform-control-plane", (file) => /^sandbox\/src\/platform(?:\/|$)/i.test(file)],
  ["production-worker", (file) => /^sandbox\/src\/workers?(?:\/|$)/i.test(file)],
  ["private-source-tree", (file) => /^(?:private|internal)(?:\/|$)/i.test(file)],
  ["environment-file", isEnvironmentFile],
  ["credential-directory", (file) => /(^|\/)(?:credentials?|secret-dumps?)(?:\/|$)/i.test(file)],
  ["private-key-file", (file) => /\.(?:pem|key|p12|pfx|keystore|jks)$/i.test(file)],
  ["runtime-database", (file) => /\.(?:sqlite3?|db|dump|backup|bak)$/i.test(file)]
];

const contentRules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["credential-in-url", /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ["cloud-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["model-or-search-key", /(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{20,}|tvly-(?:dev-|prod-)?[A-Za-z0-9_-]{16,}|ydc-sk-[A-Za-z0-9_-]{16,})/m],
  ["root-login", /\broot@[A-Za-z0-9.<>{}_-]+/i],
  ["local-user-path", /\/(?:Users\/(?!demo\/|example\/)[^/\s]+|home\/(?!demo\/|example\/)[^/\s]+)\//]
];

function isExampleIpv4(value) {
  const parts = value.split(".").map(Number);
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return ["1.1.1.1", "8.8.8.8", "8.8.4.4", "93.184.216.34"].includes(value);
}

const objectLines = git(["rev-list", "--objects", "--all"])
  .toString("utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

const pathsByOid = new Map();
for (const line of objectLines) {
  const split = line.indexOf(" ");
  const oid = split === -1 ? line : line.slice(0, split);
  const file = split === -1 ? "<unknown>" : normalize(line.slice(split + 1));
  const paths = pathsByOid.get(oid) ?? new Set();
  paths.add(file);
  pathsByOid.set(oid, paths);
}

const findings = [];
for (const [oid, paths] of pathsByOid) {
  for (const file of paths) {
    for (const [rule, matches] of forbiddenPathRules) {
      if (matches(file)) findings.push({ rule, oid, path: file });
    }
  }
}

const oids = [...pathsByOid.keys()];
const checks = git(
  ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  `${oids.join("\n")}\n`
).toString("utf8").trim().split("\n");

const blobOids = checks.flatMap((line) => {
  const [oid, type, rawSize] = line.split(" ");
  const size = Number(rawSize);
  return type === "blob" && Number.isFinite(size) && size <= MAX_TEXT_BLOB_BYTES ? [oid] : [];
});

const batch = git(["cat-file", "--batch"], `${blobOids.join("\n")}\n`);
let offset = 0;
for (const expectedOid of blobOids) {
  const headerEnd = batch.indexOf(10, offset);
  if (headerEnd === -1) throw new Error("Unexpected end of git cat-file header");
  const header = batch.subarray(offset, headerEnd).toString("utf8");
  const [oid, type, rawSize] = header.split(" ");
  if (oid !== expectedOid || type !== "blob") throw new Error(`Unexpected batch object ${header}`);
  const size = Number(rawSize);
  const start = headerEnd + 1;
  const content = batch.subarray(start, start + size);
  offset = start + size + 1;
  if (content.includes(0)) continue;
  const text = content.toString("utf8");

  for (const [rule, pattern] of contentRules) {
    if (!pattern.test(text)) continue;
    for (const file of pathsByOid.get(oid) ?? ["<unknown>"]) {
      findings.push({ rule, oid, path: file });
    }
  }

  for (const file of pathsByOid.get(oid) ?? []) {
    if (path.posix.extname(file).toLowerCase() !== ".md") continue;
    for (const match of text.matchAll(/(?<![A-Za-z0-9])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![A-Za-z0-9])/g)) {
      if (!isExampleIpv4(match[0])) {
        findings.push({ rule: "public-ip-in-documentation", oid, path: file });
      }
    }
  }
}

const unique = [...new Map(
  findings.map((finding) => [`${finding.rule}:${finding.oid}:${finding.path}`, finding])
).values()].sort((a, b) => a.rule.localeCompare(b.rule) || a.path.localeCompare(b.path));

if (unique.length > 0) {
  for (const finding of unique) {
    console.error(`${finding.rule}\t${finding.oid.slice(0, 12)}\t${finding.path}`);
  }
  console.error(`Public history check failed with ${unique.length} finding(s).`);
  process.exit(1);
}

console.log(`Public history check passed (${pathsByOid.size} reachable objects).`);
