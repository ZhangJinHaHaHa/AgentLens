import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  MAX_TEXT_BLOB_BYTES,
  boundaryPolicyFiles,
  computeGitBlobOid,
  isManagedTextPath,
  isSafeFileMode,
  inspectPublicPath,
  inspectTextContent,
  normalizePublicPath
} from "./public-boundary-policy.mjs";

// 历史发布门覆盖所有 refs 可达的 commit、tag 与 blob，而非只检查 HEAD 的最终文件树；
// 因而已经删除、改名或被多个历史路径复用的内容仍然属于公开披露面。
// 不可达对象与本地 reflog 不在这份公开历史契约内，本脚本也不会重写历史或尝试清除对象。
// 所有发现以稳定的 rule/OID/path 输出并返回非零；扫描过程对仓库保持只读，便于在 CI 中安全复跑。
const root = process.cwd();

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

function inspectPolicyIndexConsistency() {
  // 检查器从工作树加载策略代码，却审计 index 与历史；策略五件套若未与 index 对齐，
  // 当前进程所执行的规则就不能代表拟发布版本，因此先产生独立的策略漂移发现。
  const records = git(["ls-files", "--stage", "-z", "--", ...boundaryPolicyFiles])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const entriesByPath = new Map();
  for (const record of records) {
    const separator = record.indexOf("\t");
    if (separator === -1) throw new Error("Unexpected protected git index record");
    const [mode, oid, stage] = record.slice(0, separator).split(" ");
    entriesByPath.set(normalizePublicPath(record.slice(separator + 1)), { mode, oid, stage });
  }

  const policyFindings = [];
  for (const policyFile of boundaryPolicyFiles) {
    const entry = entriesByPath.get(policyFile);
    let workingOid;
    try {
      const absolutePath = path.join(root, policyFile);
      if (lstatSync(absolutePath).isFile()) {
        workingOid = computeGitBlobOid(readFileSync(absolutePath), entry?.oid);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    if (!entry || entry.stage !== "0" || !isSafeFileMode(entry.mode) || workingOid !== entry.oid) {
      policyFindings.push({
        rule: "boundary-policy-index-divergence",
        oid: entry?.oid ?? "000000000000",
        path: policyFile
      });
    }
  }
  return policyFindings;
}

const objectOids = git(["rev-list", "--objects", "--all", "--no-object-names"])
  .toString("utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

const pathsByOid = new Map(objectOids.map((oid) => [oid, new Set()]));
const historicalEntries = new Map();
const commitOids = git(["rev-list", "--all"])
  .toString("utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

// 每个提交都独立展开完整文件树；同一 blob 出现在多个路径或后来被删除时，
// 其所有历史路径仍会进入边界检查，不能被 Git 的对象去重行为隐藏。
for (const commitOid of commitOids) {
  const records = git(["ls-tree", "-r", "-z", "--full-tree", commitOid])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

  for (const record of records) {
    const separator = record.indexOf("\t");
    if (separator === -1) throw new Error("Unexpected git ls-tree record");
    const [mode, type, oid] = record.slice(0, separator).split(" ");
    if (!mode || !type || !oid) throw new Error("Incomplete git tree record");
    const file = normalizePublicPath(record.slice(separator + 1));
    historicalEntries.set(`${mode}\0${oid}\0${file}`, { mode, oid, path: file });
    if (type === "blob") {
      const paths = pathsByOid.get(oid) ?? new Set();
      paths.add(file);
      pathsByOid.set(oid, paths);
    }
  }
}

const checks = git(
  ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  `${objectOids.join("\n")}\n`
).toString("utf8").trim().split("\n");

const textObjectMetadata = checks.flatMap((line) => {
  const [oid, type, rawSize] = line.split(" ");
  const size = Number(rawSize);
  return ["blob", "commit", "tag"].includes(type) && Number.isFinite(size) ? [{ oid, type, size }] : [];
});

// 路径策略按每个历史 tree entry 执行；内容策略则按 OID 批量执行并映射回全部已知路径，
// commit/tag 消息使用虚拟路径标识，避免与仓库文件的处置流程混淆。
const findings = inspectPolicyIndexConsistency();
for (const { mode, oid, path: file } of historicalEntries.values()) {
  for (const rule of inspectPublicPath(file, { includeHistorical: true })) {
    findings.push({ rule, oid, path: file });
  }
  if (!isSafeFileMode(mode)) {
    findings.push({ rule: "unsafe-file-mode", oid, path: file });
  }
}

for (const { oid, type, size } of textObjectMetadata) {
  if (type === "blob") {
    const paths = pathsByOid.get(oid) ?? new Set();
    if (paths.size === 0) {
      findings.push({ rule: "unmapped-reachable-blob", oid, path: "<unknown>" });
    }
    if (size > MAX_TEXT_BLOB_BYTES) {
      for (const file of paths) {
        if (isManagedTextPath(file)) {
          findings.push({ rule: "oversized-text-blob", oid, path: file });
        }
      }
    }
  } else if (size > MAX_TEXT_BLOB_BYTES) {
    const label = type === "commit" ? "<commit-message>" : "<tag-message>";
    findings.push({ rule: "oversized-history-metadata", oid, path: label });
  }
}

const scannableObjectOids = textObjectMetadata
  .filter(({ size }) => size <= MAX_TEXT_BLOB_BYTES)
  .map(({ oid }) => oid);

const batch = git(["cat-file", "--batch"], `${scannableObjectOids.join("\n")}\n`);
let offset = 0;
for (const expectedOid of scannableObjectOids) {
  const headerEnd = batch.indexOf(10, offset);
  if (headerEnd === -1) throw new Error("Unexpected end of git cat-file header");
  const header = batch.subarray(offset, headerEnd).toString("utf8");
  const [oid, type, rawSize] = header.split(" ");
  if (oid !== expectedOid || !["blob", "commit", "tag"].includes(type)) {
    throw new Error(`Unexpected batch object ${header}`);
  }
  const size = Number(rawSize);
  const start = headerEnd + 1;
  const content = batch.subarray(start, start + size);
  offset = start + size + 1;
  if (content.includes(0)) {
    if (type === "blob") {
      for (const file of pathsByOid.get(oid) ?? []) {
        if (isManagedTextPath(file)) {
          findings.push({ rule: "binary-content-in-text-file", oid, path: file });
        }
      }
    } else {
      const label = type === "commit" ? "<commit-message>" : "<tag-message>";
      findings.push({ rule: "binary-content-in-history-metadata", oid, path: label });
    }
    continue;
  }
  const text = content.toString("utf8");

  for (const rule of inspectTextContent(text)) {
    const knownPaths = pathsByOid.get(oid);
    const displayPaths = type === "commit"
      ? ["<commit-message>"]
      : type === "tag"
        ? ["<tag-message>"]
        : knownPaths && knownPaths.size > 0
          ? knownPaths
          : ["<unknown>"];
    for (const file of displayPaths) {
      findings.push({ rule, oid, path: file });
    }
  }
}

const unique = [...new Map(
  findings.map((finding) => [`${finding.rule}:${finding.oid}:${finding.path}`, finding])
).values()].sort((a, b) => a.rule.localeCompare(b.rule) || a.path.localeCompare(b.path));

if (unique.length > 0) {
  // OID 截短仅用于人类诊断，去重键仍保留完整 OID，避免相同路径上的不同历史对象互相吞并。
  for (const finding of unique) {
    console.error(`${finding.rule}\t${finding.oid.slice(0, 12)}\t${finding.path}`);
  }
  console.error(`Public history check failed with ${unique.length} finding(s).`);
  process.exit(1);
}

console.log(`Public history check passed (${objectOids.length} reachable objects).`);
