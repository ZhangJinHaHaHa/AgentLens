import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  computeAuditEvidenceEventHash,
  type AuditEvidenceStage
} from "./buildAuditEvidenceEvent";
import { buildPersistedReportEventKeyFragment, validatePersistedReportEventKey } from "../report/persistAuditReport";

export interface ReadPersistedAuditEvidenceOptions {
  eventKey: string;
  baseDir?: string;
}

export type ReadPersistedAuditEvidenceResult =
  | {
      status: "verified";
      eventKey: string;
      evidenceFilePath: string;
      evidenceRoot: string;
    }
  | {
      status: "not_found";
      eventKey: string;
    }
  | {
      status: "hash_mismatch";
      eventKey: string;
      evidenceFilePath: string;
      expectedEvidenceRoot: string;
      actualEvidenceRoot: string;
    }
  | {
      status: "conflict";
      eventKey: string;
      matches: string[];
    };

interface PersistedEvidenceFile {
  schemaVersion: "audit-evidence-stream.v1";
  eventKey: string;
  tokenId: string;
  eventCount: number;
  evidenceRoot: string;
  events: Array<{
    schemaVersion: "audit-evidence.v1";
    eventKey: string;
    tokenId: string;
    sequence: number;
    stage: AuditEvidenceStage;
    timestamp: string;
    prevHash: string;
    payloadHash: string;
    eventHash: string;
  }>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function recomputeEvidenceRoot(payload: PersistedEvidenceFile): string {
  let latestEventHash = "";

  for (const event of payload.events) {
    latestEventHash = computeAuditEvidenceEventHash({
      eventKey: event.eventKey,
      tokenId: event.tokenId,
      sequence: event.sequence,
      stage: event.stage,
      timestamp: event.timestamp,
      prevHash: event.prevHash,
      payloadHash: event.payloadHash
    });
  }

  return latestEventHash;
}

export async function readPersistedAuditEvidence(
  options: ReadPersistedAuditEvidenceOptions
): Promise<ReadPersistedAuditEvidenceResult> {
  validatePersistedReportEventKey(options.eventKey);

  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "evidence"));
  const eventKeyFragment = buildPersistedReportEventKeyFragment(options.eventKey);
  const expectedNamePattern = new RegExp(
    `^\\d+-${escapeRegex(eventKeyFragment)}-([0-9a-fA-F]{64})\\.json$`
  );

  let entries: string[];
  try {
    entries = await readdir(baseDir, { withFileTypes: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "not_found", eventKey: options.eventKey };
    }
    throw error;
  }

  const matches = entries
    .map((entry) => {
      const match = entry.match(expectedNamePattern);
      if (!match || !match[1]) {
        return undefined;
      }
      return {
        evidenceFilePath: path.join(baseDir, entry),
        expectedEvidenceRoot: match[1]
      };
    })
    .filter(
      (entry): entry is { evidenceFilePath: string; expectedEvidenceRoot: string } =>
        entry !== undefined
    )
    .sort((left, right) => left.evidenceFilePath.localeCompare(right.evidenceFilePath));

  if (matches.length === 0) {
    return { status: "not_found", eventKey: options.eventKey };
  }

  if (matches.length > 1) {
    return {
      status: "conflict",
      eventKey: options.eventKey,
      matches: matches.map((match) => match.evidenceFilePath)
    };
  }

  const match = matches[0];
  const parsed = JSON.parse(await readFile(match.evidenceFilePath, "utf8")) as PersistedEvidenceFile;
  const actualEvidenceRoot = recomputeEvidenceRoot(parsed);

  if (
    actualEvidenceRoot !== match.expectedEvidenceRoot.toLowerCase() ||
    parsed.evidenceRoot.toLowerCase() !== match.expectedEvidenceRoot.toLowerCase() ||
    parsed.eventCount !== parsed.events.length
  ) {
    return {
      status: "hash_mismatch",
      eventKey: options.eventKey,
      evidenceFilePath: match.evidenceFilePath,
      expectedEvidenceRoot: match.expectedEvidenceRoot,
      actualEvidenceRoot
    };
  }

  return {
    status: "verified",
    eventKey: options.eventKey,
    evidenceFilePath: match.evidenceFilePath,
    evidenceRoot: match.expectedEvidenceRoot
  };
}
