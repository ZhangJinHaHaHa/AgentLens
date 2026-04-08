import {
  buildAuditEvidenceEvent,
  type AuditEvidenceEvent,
  type AuditEvidenceStage,
  ZERO_EVIDENCE_HASH
} from "./buildAuditEvidenceEvent";

export interface AuditEvidenceChainContext {
  eventKey: string;
  tokenId: string;
  events: AuditEvidenceEvent[];
  evidenceRoot: string;
}

export interface AuditEvidenceInput {
  stage: AuditEvidenceStage;
  timestamp?: string;
  payload: unknown;
}

export function createAuditEvidenceChainContext(input: {
  eventKey: string;
  tokenId: bigint | string;
}): AuditEvidenceChainContext {
  return {
    eventKey: input.eventKey,
    tokenId: input.tokenId.toString(),
    events: [],
    evidenceRoot: ZERO_EVIDENCE_HASH
  };
}

export function appendAuditEvidenceEvent(
  context: AuditEvidenceChainContext,
  input: AuditEvidenceInput
): AuditEvidenceEvent {
  const event = buildAuditEvidenceEvent({
    eventKey: context.eventKey,
    tokenId: context.tokenId,
    sequence: context.events.length + 1,
    stage: input.stage,
    timestamp: input.timestamp ?? new Date().toISOString(),
    prevHash: context.events.at(-1)?.eventHash ?? ZERO_EVIDENCE_HASH,
    payload: input.payload
  });

  context.events.push(event);
  context.evidenceRoot = event.eventHash;

  return event;
}
