/**
 * 这是 `SandboxManifest` 的运行时白名单校验器，把外部 JSON 收敛为仅含 agent 名、镜像和两类网络许可的规范对象。
 * 顶层额外字段、空字符串、通配 host、非 HTTP(S) RPC，以及命中内置模式的私网/环回/宿主机目标都会 fail closed，防止配置扩权被静默忽略。
 * 返回值会修剪字符串并创建新数组，输入对象不被修改；字段集合和 agent_name 正则属于 manifest 序列化兼容契约。
 * host 字符串检查不执行 DNS 解析，image 也只验证非空，因而 DNS 重绑定、公网解析及镜像真实性必须由下载/运行边界继续验证。
 * 校验失败同步抛错且发生在网络或容器副作用之前，不存在部分接受或回滚状态。
 */
import type { SandboxManifest } from "../types/manifest";

export const manifestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["agent_name", "image", "allowed_hosts", "allowed_rpc_endpoints"]
} as const;

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const FORBIDDEN_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^localhost$/i,
  /^host\.docker\.internal$/i,
  /^gateway\.docker\.internal$/i
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be a string array`);
  }

  const items = value.map((item) => {
    if (!isNonEmptyString(item)) {
      throw new Error(`${fieldName} must only contain non-empty strings`);
    }

    return item.trim();
  });

  return items;
}

function assertAllowedHost(host: string): string {
  if (host.includes("*")) {
    throw new Error("allowed_hosts cannot include wildcard entries");
  }

  if (FORBIDDEN_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    throw new Error("allowed_hosts cannot include private, loopback, or host-machine targets");
  }

  return host;
}

function assertRpcEndpoint(endpoint: string): string {
  let parsed: URL;

  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("allowed_rpc_endpoints must contain valid URLs");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("allowed_rpc_endpoints must use http or https");
  }

  if (FORBIDDEN_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new Error(
      "allowed_rpc_endpoints cannot include private, loopback, or host-machine targets"
    );
  }

  return endpoint.trim();
}

export function validateManifest(value: unknown): SandboxManifest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("manifest must be an object");
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(["agent_name", "image", "allowed_hosts", "allowed_rpc_endpoints"]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`manifest contains unsupported field: ${key}`);
    }
  }

  if (!isNonEmptyString(record.agent_name) || !AGENT_NAME_PATTERN.test(record.agent_name.trim())) {
    throw new Error("agent_name must match ^[a-zA-Z0-9_-]{1,64}$");
  }

  if (!isNonEmptyString(record.image)) {
    throw new Error("image must be a non-empty string");
  }

  const allowedHosts = assertStringArray(record.allowed_hosts, "allowed_hosts").map(assertAllowedHost);
  const allowedRpcEndpoints = assertStringArray(
    record.allowed_rpc_endpoints,
    "allowed_rpc_endpoints"
  ).map(assertRpcEndpoint);

  return {
    agent_name: record.agent_name.trim(),
    image: record.image.trim(),
    allowed_hosts: allowedHosts,
    allowed_rpc_endpoints: allowedRpcEndpoints
  };
}
