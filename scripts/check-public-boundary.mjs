import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const forbiddenPathRules = [
  ["production-infrastructure", /^infra\/production(?:\/|$)/i],
  ["private-workspace-control-plane", /^frontend\/src\/workspace(?:\/|$)/i],
  ["private-platform-control-plane", /^sandbox\/src\/platform(?:\/|$)/i],
  ["production-worker", /^sandbox\/src\/workers?(?:\/|$)/i],
  ["private-source-tree", /^(?:private|internal)(?:\/|$)/i],
  ["environment-file", /(^|\/)\.env(?:\.|$)/i],
  ["credential-directory", /(^|\/)(?:credentials?|secret-dumps?)(?:\/|$)/i],
  ["private-key-file", /\.(?:pem|key|p12|pfx|keystore|jks)$/i],
  ["runtime-database", /\.(?:sqlite3?|db|dump|backup|bak)$/i]
];

const contentRules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["credential-in-url", /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ["cloud-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["model-or-search-key", /(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{20,}|tvly-(?:dev-|prod-)?[A-Za-z0-9_-]{16,}|ydc-sk-[A-Za-z0-9_-]{16,})/m],
  ["root-login", /\broot@[A-Za-z0-9.-]+/i],
  ["local-user-path", /\/(?:Users\/(?!demo\/|example\/)[^/\s]+|home\/(?!demo\/|example\/)[^/\s]+)\//]
];

const textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sh",
  ".sol",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);

const findings = [];

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

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

async function inspectFile(absolutePath, relativePath) {
  const publicPath = normalize(relativePath);
  for (const [rule, pattern] of forbiddenPathRules) {
    if (pattern.test(publicPath)) findings.push({ rule, path: publicPath });
  }

  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) return;
  const content = await readFile(absolutePath);
  if (content.length > 2 * 1024 * 1024 || content.includes(0)) return;
  const text = content.toString("utf8");

  for (const [rule, pattern] of contentRules) {
    if (pattern.test(text)) findings.push({ rule, path: publicPath });
  }

  for (const match of text.matchAll(/(?<![A-Za-z0-9])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![A-Za-z0-9])/g)) {
    if (!isExampleIpv4(match[0])) findings.push({ rule: "public-ip-in-public-source", path: publicPath });
  }
}

const publicFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" }
).split("\0").filter(Boolean);

for (const relativePath of publicFiles) {
  await inspectFile(path.join(root, relativePath), relativePath);
}

const requiredLinks = [
  ["README.md", "https://agentlens.chat/en"],
  ["README_CN.md", "https://agentlens.chat/zh"]
];
for (const [file, expected] of requiredLinks) {
  const text = await readFile(path.join(root, file), "utf8");
  if (!text.includes(expected)) findings.push({ rule: "missing-live-platform-link", path: file });
}

const unique = [...new Map(findings.map((finding) => [`${finding.rule}:${finding.path}`, finding])).values()]
  .sort((a, b) => a.rule.localeCompare(b.rule) || a.path.localeCompare(b.path));

if (unique.length > 0) {
  for (const finding of unique) console.error(`${finding.rule}\t${finding.path}`);
  console.error(`Public boundary check failed with ${unique.length} finding(s).`);
  process.exit(1);
}

console.log("Public boundary check passed.");
