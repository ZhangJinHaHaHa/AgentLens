import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AuditRequestedEvent } from "../listener/types";
import type { AuditReportArtifact } from "./buildAuditReport";

export interface PersistAuditReportOptions {
  event: AuditRequestedEvent;
  reportArtifact: AuditReportArtifact;
  baseDir?: string;
}

export interface PersistedAuditReportArtifact {
  reportFilePath: string;
  reportFileName: string;
}

export const VALID_EVENT_KEY_PATTERN = /^0x[0-9a-fA-F]+:\d+$/;

export function validatePersistedReportEventKey(eventKey: string): void {
  if (!VALID_EVENT_KEY_PATTERN.test(eventKey)) {
    throw new Error("eventKey must match the current <transactionHash>:<logIndex> format");
  }
}

export function buildPersistedReportEventKeyFragment(eventKey: string): string {
  validatePersistedReportEventKey(eventKey);
  return eventKey.replaceAll(":", "-");
}

export function buildPersistedReportFileName(
  event: AuditRequestedEvent,
  reportArtifact: AuditReportArtifact
): string {
  validatePersistedReportEventKey(event.eventKey);

  return `${event.tokenId.toString()}-${buildPersistedReportEventKeyFragment(event.eventKey)}-${reportArtifact.reportHash}.json`;
}

export async function persistAuditReport(
  options: PersistAuditReportOptions
): Promise<PersistedAuditReportArtifact> {
  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "reports"));
  const reportFileName = buildPersistedReportFileName(options.event, options.reportArtifact);
  const reportFilePath = path.join(baseDir, reportFileName);
  const tempFilePath = path.join(baseDir, `${reportFileName}.${randomUUID()}.tmp`);

  await mkdir(baseDir, { recursive: true });
  await writeFile(tempFilePath, options.reportArtifact.reportJson, "utf8");

  try {
    await link(tempFilePath, reportFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(reportFilePath, "utf8");

    if (existing !== options.reportArtifact.reportJson) {
      throw new Error(`report file conflict at ${reportFilePath}`);
    }
  } finally {
    await rm(tempFilePath, { force: true });
  }

  return {
    reportFilePath,
    reportFileName
  };
}
