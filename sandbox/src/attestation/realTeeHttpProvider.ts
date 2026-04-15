import type { AttestationRequest, TeeProvider } from "./mockTeeProvider";
import {
  createNoopAttestationQuoteValidator,
  type AttestationQuoteValidator
} from "./attestationQuoteValidator";

export interface RealTeeHttpProviderConfig {
  backendUrl: string;
  authToken?: string;
  providerType: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  quoteValidator?: AttestationQuoteValidator;
  quoteValidation?: {
    expectedProviderType?: string;
    expectedMeasurement?: string;
    expectedQuoteFormat?: string;
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required in attestation response`);
  }

  return value;
}

export function createRealTeeHttpProvider(config: RealTeeHttpProviderConfig): TeeProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const quoteValidator = config.quoteValidator ?? createNoopAttestationQuoteValidator();

  return {
    async attest(input: AttestationRequest) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const headers: Record<string, string> = {
          "content-type": "application/json"
        };

        if (config.authToken) {
          headers.Authorization = `Bearer ${config.authToken}`;
        }

        const response = await fetchImpl(config.backendUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(input),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`real TEE backend request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          measurement?: unknown;
          quoteFormat?: unknown;
          sessionPublicKey?: unknown;
          quote?: unknown;
        };

        const result = {
          measurement: requireString(payload.measurement, "measurement"),
          quoteFormat: requireString(payload.quoteFormat, "quoteFormat"),
          sessionPublicKey: requireString(payload.sessionPublicKey, "sessionPublicKey"),
          quote: requireString(payload.quote, "quote")
        };

        await quoteValidator.validate({
          providerType: config.providerType,
          ...result
        });

        return result;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
