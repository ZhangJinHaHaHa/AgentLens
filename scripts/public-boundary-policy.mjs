import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// 本模块集中定义当前态与历史态检查器共享的判定契约，不负责遍历 Git、打印诊断或修改文件。
// 输入均视为来自仓库的非可信路径/字节；导出函数只返回分类结果，调用方拥有聚合和失败策略。
// 精确 allowlist、受控文本类型、文件模式和内容特征必须在两个检查器间保持同源，避免发布口径分叉。
export const MAX_TEXT_BLOB_BYTES = 2 * 1024 * 1024;
const safeFileModes = new Set(["100644", "100755"]);
export const boundaryPolicyFiles = Object.freeze([
  "scripts/check-public-boundary.mjs",
  "scripts/check-public-history.mjs",
  "scripts/public-boundary-policy.mjs",
  "scripts/public-files.allowlist",
  "scripts/public-history-files.allowlist"
]);

function readAllowlist(file) {
  // 清单只接受逐行精确路径：空行与独立注释被忽略，通配符不会获得特殊含义。
  return new Set(
    readFileSync(new URL(file, import.meta.url), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
  );
}

const activePublicFiles = readAllowlist("./public-files.allowlist");
const historicalPublicFiles = readAllowlist("./public-history-files.allowlist");

const forbiddenPathRules = [
  ["restricted-path-segment", /(^|\/)(?:internal|private|production)(?:\/|$)/i],
  ["environment-file", /(^|\/)\.env(?:\.|$)/i],
  ["credential-directory", /(^|\/)(?:credentials?|secret-dumps?)(?:\/|$)/i],
  ["private-key-file", /\.(?:pem|key|p12|pfx|keystore|jks)$/i],
  ["runtime-database", /\.(?:sqlite3?|db|dump|backup|bak)$/i]
];

export const contentRules = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["credential-in-url", /https?:\/\/[^\s/:]+:[^\s/@]+@/i],
  ["cloud-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["model-or-search-key", /(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{20,}|tvly-(?:dev-|prod-)?[A-Za-z0-9_-]{16,}|ydc-sk-[A-Za-z0-9_-]{16,})/m],
  ["root-login", /\broot@[A-Za-z0-9.<>{}_-]+/i],
  ["local-user-path", /\/(?:Users\/(?!demo\/|example\/)[^/\s]+|home\/(?!demo\/|example\/)[^/\s]+)\//]
];

export const textExtensions = new Set([
  "",
  ".allowlist",
  ".circom",
  ".cjs",
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".llm",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".sol",
  ".svg",
  ".template",
  ".ts",
  ".tsx",
  ".txt",
  ".webmanifest",
  ".yaml",
  ".yml"
]);

export function normalizePublicPath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export function isManagedTextPath(relativePath) {
  const publicPath = normalizePublicPath(relativePath);
  return textExtensions.has(path.posix.extname(publicPath).toLowerCase());
}

export function isSafeFileMode(mode) {
  return safeFileModes.has(mode);
}

export function computeGitBlobOid(content, expectedOid) {
  // 由 index OID 长度选择仓库对象格式，兼容 SHA-1 与 SHA-256 仓库；未知长度必须拒绝比较，
  // 不能用当前工作树策略对无法证明同一性的拟提交 blob 做宽松兜底。
  const algorithm = expectedOid?.length === 40 ? "sha1" : expectedOid?.length === 64 ? "sha256" : undefined;
  if (!algorithm) return undefined;
  return createHash(algorithm)
    .update(`blob ${content.length}\0`)
    .update(content)
    .digest("hex");
}

function hasSafeRepositoryPathShape(publicPath) {
  // 分隔符规范化之后仍显式拒绝绝对路径、控制字符和遍历段，不依赖文件系统解析来“修正”输入。
  if (publicPath.length === 0 || publicPath.startsWith("/")) return false;
  if (/\p{Cc}/u.test(publicPath) || publicPath.includes("\\")) return false;
  return publicPath.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isDocumentedPublicPath(publicPath, includeHistorical) {
  // 历史清单只在历史扫描显式启用；它不能把已删除路径重新授权进当前公开文件面。
  return activePublicFiles.has(publicPath)
    || (includeHistorical && historicalPublicFiles.has(publicPath));
}

export function inspectPublicPath(relativePath, { includeHistorical = false } = {}) {
  const publicPath = normalizePublicPath(relativePath);
  const rules = [];

  if (!hasSafeRepositoryPathShape(publicPath)) {
    rules.push("unsafe-repository-path");
  } else if (!isDocumentedPublicPath(publicPath, includeHistorical)) {
    rules.push("outside-documented-public-surface");
  }

  for (const [rule, pattern] of forbiddenPathRules) {
    if (pattern.test(publicPath)) rules.push(rule);
  }
  return rules;
}

function isExampleIpv4(value) {
  // 文档保留地址、回环/私网及少量公共演示解析器属于可公开示例；其余有效 IPv4 默认按泄露处理。
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

export function inspectTextContent(text) {
  const rules = [];
  for (const [rule, pattern] of contentRules) {
    if (pattern.test(text)) rules.push(rule);
  }

  for (const match of text.matchAll(/(?<![A-Za-z0-9])(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?![A-Za-z0-9])/g)) {
    if (!isExampleIpv4(match[0])) rules.push("public-ip-in-public-source");
  }
  return [...new Set(rules)];
}
