import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AuditEvidenceChainContext } from "./evidenceChain";
import { validatePersistedReportEventKey, buildPersistedReportEventKeyFragment } from "../report/persistAuditReport";

export interface PersistAuditEvidenceOptions {
  eventKey: string;
  tokenId: bigint | string;
  chain: AuditEvidenceChainContext;
  baseDir?: string;
}

export interface PersistedAuditEvidenceArtifact {
  evidenceFilePath: string;
  evidenceFileName: string;
  evidenceRoot: string;
}

function buildEvidenceFileName(options: PersistAuditEvidenceOptions): string {
  validatePersistedReportEventKey(options.eventKey);
  return `${options.tokenId.toString()}-${buildPersistedReportEventKeyFragment(options.eventKey)}-${options.chain.evidenceRoot}.json`;
}

function buildEvidenceJson(options: PersistAuditEvidenceOptions): string {
  return JSON.stringify(
    {
      schemaVersion: "audit-evidence-stream.v1",
      eventKey: options.eventKey,
      tokenId: options.tokenId.toString(),
      eventCount: options.chain.events.length,
      evidenceRoot: options.chain.evidenceRoot,
      events: options.chain.events
    },
    null,
    2
  );
}

export async function persistAuditEvidence(
  options: PersistAuditEvidenceOptions
): Promise<PersistedAuditEvidenceArtifact> {
  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "evidence"));
  const evidenceFileName = buildEvidenceFileName(options);
  const evidenceFilePath = path.join(baseDir, evidenceFileName);
  const tempFilePath = path.join(baseDir, `${evidenceFileName}.${randomUUID()}.tmp`);
  const evidenceJson = buildEvidenceJson(options);

  await mkdir(baseDir, { recursive: true });
  await writeFile(tempFilePath, evidenceJson, "utf8");

  try {
    await link(tempFilePath, evidenceFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(evidenceFilePath, "utf8");
    if (existing !== evidenceJson) {
      throw new Error(`evidence file conflict at ${evidenceFilePath}`);
    }
  } finally {
    await rm(tempFilePath, { force: true });
  }

  return {
    evidenceFilePath,
    evidenceFileName,
    evidenceRoot: options.chain.evidenceRoot
  };
}
