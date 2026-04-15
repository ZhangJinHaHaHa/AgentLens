import { readFile } from "node:fs/promises";

import type { AuditRequestedEvent, StoredAuditReportIdentifiers } from "../listener/types";
import type { AuditReportArtifact } from "./buildAuditReport";
import type { PersistedAuditReportArtifact } from "./persistAuditReport";

export interface StorePersistedAuditReportOptions {
  event: AuditRequestedEvent;
  reportArtifact: AuditReportArtifact;
  reportPersistence: PersistedAuditReportArtifact;
  cosKeyPrefix?: string;
}

export interface RemoteReportStorageDeps {
  putObject(input: {
    objectKey: string;
    body: Buffer;
    contentType: "application/json";
  }): Promise<void>;
  addToIpfs(input: { body: Buffer; fileName: string }): Promise<{ cid: string }>;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "-");
}

function buildSanitizedEventKeySegment(eventKey: string): string {
  return sanitizePathSegment(eventKey);
}

function buildCosObjectKey(
  event: AuditRequestedEvent,
  reportArtifact: AuditReportArtifact,
  keyPrefix: string
): string {
  const sanitizedEventKey = buildSanitizedEventKeySegment(event.eventKey);
  return `${keyPrefix}/${event.tokenId.toString()}/${sanitizedEventKey}/${reportArtifact.reportHash}.json`;
}

function buildIpfsFileName(
  event: AuditRequestedEvent,
  reportArtifact: AuditReportArtifact
): string {
  const sanitizedEventKey = buildSanitizedEventKeySegment(event.eventKey);
  return `${event.tokenId.toString()}-${sanitizedEventKey}-${reportArtifact.reportHash}.json`;
}

export async function storePersistedAuditReport(
  options: StorePersistedAuditReportOptions,
  deps: RemoteReportStorageDeps
): Promise<StoredAuditReportIdentifiers> {
  const reportBytes = await readFile(options.reportPersistence.reportFilePath);
  const normalizedPrefix = (options.cosKeyPrefix ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const cosObjectKey = buildCosObjectKey(
    options.event,
    options.reportArtifact,
    normalizedPrefix || "reports"
  );

  await deps.putObject({
    objectKey: cosObjectKey,
    body: reportBytes,
    contentType: "application/json"
  });

  const ipfsResult = await deps.addToIpfs({
    body: reportBytes,
    fileName: buildIpfsFileName(options.event, options.reportArtifact)
  });

  return {
    reportCid: ipfsResult.cid,
    cosObjectKey
  };
}
