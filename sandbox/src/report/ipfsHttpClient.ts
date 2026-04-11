export interface IpfsHttpClientConfig {
  apiUrl: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
}

import CID from "cids";

export interface IpfsHttpClient {
  addToIpfs(input: { body: Buffer; fileName: string }): Promise<{ cid: string }>;
}

function parseCid(value: unknown): { ok: true } | { ok: false; reason: "missing" | "invalid" } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  try {
    // cids validates both CIDv0 (Qm...) and CIDv1 (multibase like bafy/zb...).
    new CID(value);
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function createIpfsHttpClient(config: IpfsHttpClientConfig): IpfsHttpClient {
  if (!config.apiUrl) {
    throw new Error("apiUrl is required");
  }

  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async addToIpfs(input: { body: Buffer; fileName: string }): Promise<{ cid: string }> {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(input.body)], { type: "application/json" });
      formData.append("file", blob, input.fileName);

      const headers: Record<string, string> = {};
      if (config.authToken) {
        headers.Authorization = `Bearer ${config.authToken}`;
      }

      const response = await fetchImpl(config.apiUrl, {
        method: "POST",
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`IPFS upload failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { cid?: unknown };
      const cidValidation = parseCid(payload.cid);
      if (!cidValidation.ok) {
        if (cidValidation.reason === "missing") {
          throw new Error("cid is missing from IPFS response");
        }
        throw new Error("cid is invalid in IPFS response");
      }

      return { cid: payload.cid as string };
    }
  };
}
