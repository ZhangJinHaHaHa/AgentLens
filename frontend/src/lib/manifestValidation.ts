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
  | "allowedHostsRequired"
  | "allowedHostsWildcard"
  | "allowedHostsPrivate"
  | "allowedHostsInvalid"
  | "allowedHostsPath"
  | "rpcRequired"
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

  if (allowedHosts.length === 0) {
    errors.push("allowedHostsRequired");
  }

  const normalizedHosts = allowedHosts.map((host) => normalizeHost(host, errors));

  if (allowedRpcEndpoints.length === 0) {
    errors.push("rpcRequired");
  }

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
