import { execFileSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
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

// 当前态发布门以 Git index 作为“将要公开”的权威输入，同时扫描工作树和未跟踪文件，
// 让提交前反馈不遗漏尚未暂存的风险；工作树扫描不会取代对 index blob 的独立校验。
// 受保护策略文件必须在 index 与磁盘上逐字节一致，否则正在执行的宽松规则可能替拟提交内容背书。
// 本脚本只读取仓库、聚合稳定的 rule/path 诊断并以退出码阻断发布，不删除、改写或自动暂存文件。
const root = process.cwd();

const findings = [];
const indexedTextByPath = new Map();
const workingTextByPath = new Map();

function inspectPath(relativePath) {
  const publicPath = normalizePublicPath(relativePath);
  for (const rule of inspectPublicPath(publicPath)) {
    findings.push({ rule, path: publicPath });
  }
  return publicPath;
}

function inspectManagedContent(content, publicPath) {
  if (!isManagedTextPath(publicPath)) return undefined;
  if (content.length > MAX_TEXT_BLOB_BYTES) {
    findings.push({ rule: "oversized-text-blob", path: publicPath });
    return undefined;
  }
  if (content.includes(0)) {
    findings.push({ rule: "binary-content-in-text-file", path: publicPath });
    return undefined;
  }
  const text = content.toString("utf8");

  for (const rule of inspectTextContent(text)) {
    findings.push({ rule, path: publicPath });
  }
  return text;
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    maxBuffer: 512 * 1024 * 1024,
    ...options
  });
}

const indexRecords = git(["ls-files", "--stage", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const indexTextPathsByOid = new Map();
const indexEntriesByPath = new Map();

for (const record of indexRecords) {
  const separator = record.indexOf("\t");
  if (separator === -1) throw new Error("Unexpected git ls-files --stage record");
  const [mode, oid, stage] = record.slice(0, separator).split(" ");
  const publicPath = inspectPath(record.slice(separator + 1));
  if (!mode || !oid || !stage) throw new Error("Incomplete git index record");
  indexEntriesByPath.set(publicPath, { mode, oid, stage });
  if (stage !== "0") {
    findings.push({ rule: "unmerged-index-entry", path: publicPath });
    continue;
  }
  if (!isSafeFileMode(mode)) {
    findings.push({ rule: "unsafe-file-mode", path: publicPath });
    continue;
  }
  if (!isManagedTextPath(publicPath)) continue;
  const paths = indexTextPathsByOid.get(oid) ?? new Set();
  paths.add(publicPath);
  indexTextPathsByOid.set(oid, paths);
}

// 发布策略必须与 proposed index 完全一致；否则工作树中的宽松策略可能掩盖
// 实际将被提交的严格清单或旧检查器，造成本地发布门误判。
for (const policyFile of boundaryPolicyFiles) {
  const entry = indexEntriesByPath.get(policyFile);
  try {
    const fileStatus = await lstat(path.join(root, policyFile));
    const content = fileStatus.isFile() ? await readFile(path.join(root, policyFile)) : undefined;
    const workingOid = content ? computeGitBlobOid(content, entry?.oid) : undefined;
    if (!entry || entry.stage !== "0" || !isSafeFileMode(entry.mode) || workingOid !== entry.oid) {
      findings.push({ rule: "boundary-policy-index-divergence", path: policyFile });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    findings.push({ rule: "boundary-policy-index-divergence", path: policyFile });
  }
}

const indexOids = [...indexTextPathsByOid.keys()];
if (indexOids.length > 0) {
  // 先批量读取对象类型与长度，再读取已通过上限的 blob；这样恶意大对象不会先进入进程内存，
  // 同一 OID 被多个路径引用时仍会为每个公开路径保留独立诊断归属。
  const metadataLines = git(
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    { input: `${indexOids.join("\n")}\n`, encoding: "utf8" }
  ).trim().split("\n");
  const readableOids = [];

  for (let index = 0; index < indexOids.length; index += 1) {
    const expectedOid = indexOids[index];
    const [oid, type, rawSize] = (metadataLines[index] ?? "").split(" ");
    const size = Number(rawSize);
    const paths = indexTextPathsByOid.get(expectedOid) ?? [];
    if (oid !== expectedOid || type !== "blob" || !Number.isFinite(size)) {
      for (const publicPath of paths) findings.push({ rule: "unreadable-index-blob", path: publicPath });
      continue;
    }
    if (size > MAX_TEXT_BLOB_BYTES) {
      for (const publicPath of paths) findings.push({ rule: "oversized-text-blob", path: publicPath });
      continue;
    }
    readableOids.push(oid);
  }

  if (readableOids.length > 0) {
    const batch = git(["cat-file", "--batch"], { input: `${readableOids.join("\n")}\n` });
    let offset = 0;
    for (const expectedOid of readableOids) {
      const headerEnd = batch.indexOf(10, offset);
      if (headerEnd === -1) throw new Error("Unexpected end of git cat-file header");
      const header = batch.subarray(offset, headerEnd).toString("utf8");
      const [oid, type, rawSize] = header.split(" ");
      if (oid !== expectedOid || type !== "blob") throw new Error(`Unexpected batch object ${header}`);
      const size = Number(rawSize);
      const start = headerEnd + 1;
      const content = batch.subarray(start, start + size);
      offset = start + size + 1;

      for (const publicPath of indexTextPathsByOid.get(oid) ?? []) {
        const text = inspectManagedContent(content, publicPath);
        if (text !== undefined) indexedTextByPath.set(publicPath, text);
      }
    }
  }
}

// 同时扫描工作树，既覆盖未跟踪文件，也保留对尚未暂存修改的即时反馈。
const workingTreeFiles = git(
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" }
).split("\0").filter(Boolean);

for (const relativePath of workingTreeFiles) {
  const publicPath = inspectPath(relativePath);
  try {
    const fileStatus = await lstat(path.join(root, relativePath));
    if (!fileStatus.isFile()) {
      findings.push({ rule: "unsafe-file-mode", path: publicPath });
      continue;
    }
    if (!isManagedTextPath(publicPath)) continue;
    const content = await readFile(path.join(root, relativePath));
    const text = inspectManagedContent(content, publicPath);
    if (text !== undefined) workingTextByPath.set(publicPath, text);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const requiredLinks = [
  ["README.md", "https://agentlens.chat/en"],
  ["README_CN.md", "https://agentlens.chat/zh"]
];
// README 的线上入口属于公开发布契约；优先检查 index 文本，未暂存的新文件才回退到工作树视图。
for (const [file, expected] of requiredLinks) {
  const text = indexedTextByPath.get(file) ?? workingTextByPath.get(file);
  if (!text?.includes(expected)) findings.push({ rule: "missing-live-platform-link", path: file });
}

const unique = [...new Map(findings.map((finding) => [`${finding.rule}:${finding.path}`, finding])).values()]
  .sort((a, b) => a.rule.localeCompare(b.rule) || a.path.localeCompare(b.path));

if (unique.length > 0) {
  // 排序和去重使 CI 输出可复现；非零退出是唯一机器接口，调用方不应解析自然语言摘要。
  for (const finding of unique) console.error(`${finding.rule}\t${finding.path}`);
  console.error(`Public boundary check failed with ${unique.length} finding(s).`);
  process.exit(1);
}

console.log("Public boundary check passed.");
