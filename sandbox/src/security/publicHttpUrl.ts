import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export class PublicHttpUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicHttpUrlError";
  }
}

export type PublicHttpLookup = (
  hostname: string
) => Promise<readonly { address: string; family: number }[]>;

export interface PublicHttpUrlOptions {
  requireHttps?: boolean;
  lookupHost?: PublicHttpLookup;
  skipDnsLookup?: boolean;
}

export interface PublicHttpFetchOptions extends PublicHttpUrlOptions {
  fetchImpl?: typeof fetch;
  headers?: HeadersInit;
  signal?: AbortSignal;
  maxRedirects?: number;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "host.docker.internal",
  "gateway.docker.internal",
  "metadata.google.internal"
]);

const DEFAULT_MAX_REDIRECTS = 3;

export function isPotentialPublicHttpUrl(value: string, options: PublicHttpUrlOptions = {}): boolean {
  try {
    const parsedUrl = new URL(value);
    validatePublicHttpUrlShape(parsedUrl, options);
    return true;
  } catch {
    return false;
  }
}

export async function assertPublicHttpUrl(
  value: string | URL,
  options: PublicHttpUrlOptions = {}
): Promise<URL> {
  const parsedUrl = typeof value === "string" ? new URL(value) : value;
  validatePublicHttpUrlShape(parsedUrl, options);

  const host = normalizeHostname(parsedUrl.hostname);
  if (isIP(host) !== 0 || options.skipDnsLookup) {
    return parsedUrl;
  }

  const lookupHost = options.lookupHost ?? defaultLookupHost;
  const results = await lookupHost(host);
  if (results.length === 0) {
    throw new PublicHttpUrlError(`URL host "${host}" did not resolve.`);
  }

  const privateAddress = results.find((result) => isPrivateAddress(result.address));
  if (privateAddress) {
    throw new PublicHttpUrlError(
      `URL host "${host}" resolves to a non-public address.`
    );
  }

  return parsedUrl;
}

export async function fetchPublicHttpUrl(
  value: string | URL,
  options: PublicHttpFetchOptions = {}
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let currentUrl = typeof value === "string" ? new URL(value) : value;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    currentUrl = await assertPublicHttpUrl(currentUrl, {
      requireHttps: options.requireHttps,
      lookupHost: options.lookupHost,
      skipDnsLookup: options.skipDnsLookup ?? (fetchImpl !== fetch && !options.lookupHost)
    });

    const response = await fetchImpl(currentUrl.toString(), {
      headers: options.headers,
      signal: options.signal,
      redirect: "manual"
    });

    if (!isRedirectResponse(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new PublicHttpUrlError(`Redirect from ${currentUrl.toString()} did not include a location.`);
    }

    if (redirectCount === maxRedirects) {
      throw new PublicHttpUrlError(`URL exceeded ${maxRedirects} redirects.`);
    }

    currentUrl = new URL(location, currentUrl);
  }

  throw new PublicHttpUrlError(`URL exceeded ${maxRedirects} redirects.`);
}

function validatePublicHttpUrlShape(parsedUrl: URL, options: PublicHttpUrlOptions): void {
  const allowedProtocols = options.requireHttps ? ["https:"] : ["http:", "https:"];
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    throw new PublicHttpUrlError(options.requireHttps ? "URL must use https." : "URL must use http or https.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new PublicHttpUrlError("URL credentials are not allowed.");
  }

  const host = normalizeHostname(parsedUrl.hostname);
  if (!host) {
    throw new PublicHttpUrlError("URL host is required.");
  }

  if (isBlockedHostname(host) || isPrivateAddress(host)) {
    throw new PublicHttpUrlError("URL host must resolve to a public address.");
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
}

function isBlockedHostname(host: string): boolean {
  return BLOCKED_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".localhost");
}

function isPrivateAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isPrivateIpv4(normalized);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(normalized);
  }
  return false;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 192 && b === 0 ||
    a === 192 && b === 0 && octets[2] === 2 ||
    a === 198 && (b === 18 || b === 19) ||
    a === 198 && b === 51 && octets[2] === 100 ||
    a === 203 && b === 0 && octets[2] === 113 ||
    a >= 224 ||
    a === 255
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("::ffff:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  ) {
    return true;
  }
  return false;
}

async function defaultLookupHost(hostname: string): Promise<readonly { address: string; family: number }[]> {
  return dnsLookup(hostname, { all: true, verbatim: false });
}

function isRedirectResponse(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
