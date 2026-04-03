import { createHash } from "node:crypto";

import type { AuditRequestedEvent } from "../listener/types";

export interface AuditAttestationBundle {
  schemaVersion: "audit-attestation.v1";
  eventKey: string;
  tokenId: string;
  manifestHash: string;
  evidenceRoot: string;
  verifier: {
    type: string;
    measurement: string;
    quoteFormat: string;
    sessionPublicKey: string;
    quote: string;
  };
}

export interface AuditAttestationArtifact {
  attestationHash: string;
  bundle: AuditAttestationBundle;
  bundleJson: string;
}

export interface CreateAuditAttestationInput {
  event: AuditRequestedEvent;
  manifestHash: string;
  evidenceRoot: string;
}

export interface CreateAuditAttestationResult extends AuditAttestationArtifact {}

export function computeAuditAttestationHash(bundleJson: string): string {
  return createHash("sha256").update(bundleJson).digest("hex");
}

export function buildAuditAttestationArtifact(
  bundle: AuditAttestationBundle
): AuditAttestationArtifact {
  const bundleJson = JSON.stringify(bundle, null, 2);

  return {
    attestationHash: computeAuditAttestationHash(bundleJson),
    bundle,
    bundleJson
  };
}
