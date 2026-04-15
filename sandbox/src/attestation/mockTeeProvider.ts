export interface AttestationRequest {
  schemaVersion: "audit-attestation-request.v1";
  eventKey: string;
  tokenId: string;
  manifestHash: string;
  evidenceRoot: string;
  manifestUrl: string;
}

export interface TeeProvider {
  attest(input: AttestationRequest): Promise<{
    measurement: string;
    quoteFormat: string;
    sessionPublicKey: string;
    quote: string;
  }>;
}

export function createMockTeeProvider(): TeeProvider {
  return {
    async attest(_input: AttestationRequest) {
      return {
        measurement: "a".repeat(64),
        quoteFormat: "mock-quote",
        sessionPublicKey: "mock-session-public-key",
        quote: "mock-attestation-quote"
      };
    }
  };
}
