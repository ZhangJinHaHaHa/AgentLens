import {
  buildAuditAttestationArtifact,
  type CreateAuditAttestationInput,
  type CreateAuditAttestationResult
} from "./buildAuditAttestation";
import type { AttestationConfig } from "./readAttestationConfig";

export interface HttpAttestationClient {
  createAuditAttestation(input: CreateAuditAttestationInput): Promise<CreateAuditAttestationResult>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required in attestation response`);
  }

  return value;
}

export function createHttpAttestationClient(
  config: AttestationConfig & { fetchImpl?: typeof fetch }
): HttpAttestationClient {
  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async createAuditAttestation(
      input: CreateAuditAttestationInput
    ): Promise<CreateAuditAttestationResult> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const headers: Record<string, string> = {
          "content-type": "application/json"
        };

        if (config.authToken) {
          headers.Authorization = `Bearer ${config.authToken}`;
        }

        const response = await fetchImpl(config.apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            schemaVersion: "audit-attestation-request.v1",
            eventKey: input.event.eventKey,
            tokenId: input.event.tokenId.toString(),
            manifestHash: input.manifestHash,
            evidenceRoot: input.evidenceRoot,
            manifestUrl: input.event.manifestUrl
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`attestation request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          measurement?: unknown;
          quoteFormat?: unknown;
          sessionPublicKey?: unknown;
          quote?: unknown;
        };

        return buildAuditAttestationArtifact({
          schemaVersion: "audit-attestation.v1",
          eventKey: input.event.eventKey,
          tokenId: input.event.tokenId.toString(),
          manifestHash: input.manifestHash,
          evidenceRoot: input.evidenceRoot,
          verifier: {
            type: config.providerType,
            measurement: requireString(payload.measurement, "measurement"),
            quoteFormat: requireString(payload.quoteFormat, "quoteFormat"),
            sessionPublicKey: requireString(payload.sessionPublicKey, "sessionPublicKey"),
            quote: requireString(payload.quote, "quote")
          }
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
