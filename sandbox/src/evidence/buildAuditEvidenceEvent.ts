import { createHash } from "node:crypto";

export const ZERO_EVIDENCE_HASH = "0".repeat(64);

export type AuditEvidenceStage =
  | "audit_requested_observed"
  | "manifest_fetched"
  | "manifest_validated"
  | "container_started"
  | "healthcheck_passed"
  | "audit_request_sent"
  | "audit_response_received"
  | "resource_usage_collected"
  | "network_activity_collected"
  | "report_built";

export interface AuditEvidenceEvent {
  schemaVersion: "audit-evidence.v1";
  eventKey: string;
  tokenId: string;
  sequence: number;
  stage: AuditEvidenceStage;
  timestamp: string;
  prevHash: string;
  payloadHash: string;
  eventHash: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
    );
  }

  return value;
}

function hashCanonicalValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function computeEvidencePayloadHash(payload: unknown): string {
  return hashCanonicalValue(payload);
}

export function computeAuditEvidenceEventHash(input: {
  eventKey: string;
  tokenId: string;
  sequence: number;
  stage: AuditEvidenceStage;
  timestamp: string;
  prevHash: string;
  payloadHash: string;
}): string {
  return hashCanonicalValue({
    schemaVersion: "audit-evidence.v1",
    eventKey: input.eventKey,
    tokenId: input.tokenId,
    sequence: input.sequence,
    stage: input.stage,
    timestamp: input.timestamp,
    prevHash: input.prevHash,
    payloadHash: input.payloadHash
  });
}

export function buildAuditEvidenceEvent(input: {
  eventKey: string;
  tokenId: string;
  sequence: number;
  stage: AuditEvidenceStage;
  timestamp: string;
  prevHash: string;
  payload: unknown;
}): AuditEvidenceEvent {
  const payloadHash = computeEvidencePayloadHash(input.payload);
  const eventHash = computeAuditEvidenceEventHash({
    eventKey: input.eventKey,
    tokenId: input.tokenId,
    sequence: input.sequence,
    stage: input.stage,
    timestamp: input.timestamp,
    prevHash: input.prevHash,
    payloadHash
  });

  return {
    schemaVersion: "audit-evidence.v1",
    eventKey: input.eventKey,
    tokenId: input.tokenId,
    sequence: input.sequence,
    stage: input.stage,
    timestamp: input.timestamp,
    prevHash: input.prevHash,
    payloadHash,
    eventHash
  };
}
