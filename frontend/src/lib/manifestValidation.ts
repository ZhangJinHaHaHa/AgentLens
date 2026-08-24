/**
 * 发布表单到 agent manifest 的第一道客户端收敛：裁剪名称/镜像/URL，拆分 host 与 RPC 列表，并返回规范化对象及去重错误码。
 * 名称限定安全字符和长度，host 会剥离 HTTP(S) URL 至 host 并拒绝剩余路径、通配符及常见私网地址，RPC/manifest URL 限定 HTTP(S)；过程不联网或重试。
 * 这是浏览器不可信输入边界而非完整 SSRF 防线：DNS 重绑定、域名解析后的私网 IP、编码变体、镜像真实性和远端内容均须服务端在使用时再次验证。
 * 即使失败也返回规范化草稿供表单回显，调用方必须以 `ok`/errors 阻止发布，不能因 manifest 对象存在就继续签名或抓取。
 * 列表允许换行/逗号并保留顺序，URL 采用平台标准序列化；这些输出格式需与服务端 manifest schema 保持兼容。
 */
export interface AgentManifest {
  agent_name: string;
  image: string;
  allowed_hosts: string[];
  allowed_rpc_endpoints: string[];
}

export interface AgentManifestInput {
  agentName: string;
  image: string;
  allowedHosts: string;
  allowedRpcEndpoints: string;
  manifestUrl: string;
}

export type AgentManifestValidationError =
  | "agentName"
  | "image"
  | "allowedHostsWildcard"
  | "allowedHostsPrivate"
  | "allowedHostsInvalid"
  | "allowedHostsPath"
  | "rpcInvalid"
  | "rpcProtocol"
  | "rpcPrivate"
  | "manifestUrlInvalid"
  | "manifestUrlProtocol";

export type AgentManifestValidationResult =
  | {
      ok: true;
      manifest: AgentManifest;
      manifestUrl: string;
    }
  | {
      ok: false;
      errors: AgentManifestValidationError[];
      manifest: AgentManifest;
      manifestUrl: string;
    };

const AGENT_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const FORBIDDEN_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^localhost$/i,
  /^host\.docker\.internal$/i,
  /^gateway\.docker\.internal$/i,
  /^::1$/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i
];

export function validateAgentManifestInput(input: AgentManifestInput): AgentManifestValidationResult {
  const errors: AgentManifestValidationError[] = [];
  const agentName = input.agentName.trim();
  const image = input.image.trim();
  const allowedHosts = parseList(input.allowedHosts);
  const allowedRpcEndpoints = parseList(input.allowedRpcEndpoints);
  const manifestUrl = input.manifestUrl.trim();

  if (!AGENT_NAME_PATTERN.test(agentName)) {
    errors.push("agentName");
  }

  if (image.length === 0) {
    errors.push("image");
  }

  const normalizedHosts = allowedHosts.map((host) => normalizeHost(host, errors));

  const normalizedRpcEndpoints = allowedRpcEndpoints.map((endpoint) => normalizeRpcEndpoint(endpoint, errors));

  validateManifestUrl(manifestUrl, errors);

  const manifest = {
    agent_name: agentName,
    image,
    allowed_hosts: normalizedHosts,
    allowed_rpc_endpoints: normalizedRpcEndpoints
  };

  return errors.length === 0
    ? { ok: true, manifest, manifestUrl }
    : { ok: false, errors: unique(errors), manifest, manifestUrl };
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHost(value: string, errors: AgentManifestValidationError[]): string {
  const trimmed = value.trim();
  if (trimmed.includes("*")) {
    errors.push("allowedHostsWildcard");
  }

  let host = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      host = parsed.host;
    }
  } catch {
    errors.push("allowedHostsInvalid");
  }

  const hostname = host.split(":")[0] ?? host;
  if (hostname.length === 0 || /[/?#]/.test(host)) {
    errors.push("allowedHostsPath");
  }

  if (isForbiddenHost(hostname)) {
    errors.push("allowedHostsPrivate");
  }

  return host;
}

function normalizeRpcEndpoint(value: string, errors: AgentManifestValidationError[]): string {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push("rpcProtocol");
    }
    if (isForbiddenHost(parsed.hostname)) {
      errors.push("rpcPrivate");
    }
    return parsed.toString();
  } catch {
    errors.push("rpcInvalid");
    return trimmed;
  }
}

function validateManifestUrl(value: string, errors: AgentManifestValidationError[]): void {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push("manifestUrlProtocol");
    }
  } catch {
    errors.push("manifestUrlInvalid");
  }
}

function isForbiddenHost(hostname: string): boolean {
  return FORBIDDEN_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
