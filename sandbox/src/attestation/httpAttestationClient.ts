import {
  createCompositeAttestationQuoteValidator,
  createExpectedAttestationQuoteValidator,
  type AttestationQuoteValidator
} from "./attestationQuoteValidator";
import {
  buildAuditAttestationArtifact,
  type CreateAuditAttestationInput,
  type CreateAuditAttestationResult
} from "./buildAuditAttestation";
import type {
  AttestationConfig,
  AttestationVerificationConfig
} from "./readAttestationConfig";
import { createSgxDcapQuoteValidator } from "./sgxDcapQuoteValidator";

export interface HttpAttestationClient {
  createAuditAttestation(input: CreateAuditAttestationInput): Promise<CreateAuditAttestationResult>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required in attestation response`);
  }

  return value;
}

function buildPerRequestQuoteValidator(
  verification: AttestationVerificationConfig,
  input: CreateAuditAttestationInput
): AttestationQuoteValidator {
  const validators: AttestationQuoteValidator[] = [
    createExpectedAttestationQuoteValidator({
      expectedProviderType: verification.expectedProviderType,
      expectedMeasurement: verification.expectedMeasurement,
      expectedQuoteFormat: verification.expectedQuoteFormat
    })
  ];

  const shouldRunSgxValidator =
    verification.expectedQuoteFormat === "sgx-dcap-v3" ||
    verification.verifyReportDataBinding === true ||
    Boolean(verification.expectedMeasurement);

  if (shouldRunSgxValidator) {
    validators.push(
      createSgxDcapQuoteValidator({
        expectedMrEnclave: verification.expectedMeasurement,
        ...(verification.verifyReportDataBinding
          ? {
              expectedEventKey: input.event.eventKey,
              expectedManifestHash: input.manifestHash,
              expectedEvidenceRoot: input.evidenceRoot
            }
          : {})
      })
    );
  }

  return validators.length === 1
    ? validators[0]
    : createCompositeAttestationQuoteValidator(validators);
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

        const verifier = {
          type: config.providerType,
          measurement: requireString(payload.measurement, "measurement"),
          quoteFormat: requireString(payload.quoteFormat, "quoteFormat"),
          sessionPublicKey: requireString(payload.sessionPublicKey, "sessionPublicKey"),
          quote: requireString(payload.quote, "quote")
        };

        if (config.verification) {
          const validator = buildPerRequestQuoteValidator(config.verification, input);
          await validator.validate({
            providerType: verifier.type,
            measurement: verifier.measurement,
            quoteFormat: verifier.quoteFormat,
            sessionPublicKey: verifier.sessionPublicKey,
            quote: verifier.quote
          });
        }

        return buildAuditAttestationArtifact({
          schemaVersion: "audit-attestation.v1",
          eventKey: input.event.eventKey,
          tokenId: input.event.tokenId.toString(),
          manifestHash: input.manifestHash,
          evidenceRoot: input.evidenceRoot,
          verifier
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
