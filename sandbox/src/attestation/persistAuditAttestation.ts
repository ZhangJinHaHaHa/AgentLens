import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { buildPersistedReportEventKeyFragment, validatePersistedReportEventKey } from "../report/persistAuditReport";
import type { AuditAttestationArtifact } from "./buildAuditAttestation";

export interface PersistAuditAttestationOptions {
  eventKey: string;
  tokenId: bigint | string;
  attestationArtifact: AuditAttestationArtifact;
  baseDir?: string;
}

export interface PersistedAuditAttestationArtifact {
  attestationFilePath: string;
  attestationFileName: string;
  attestationHash: string;
}

function buildAttestationFileName(options: PersistAuditAttestationOptions): string {
  validatePersistedReportEventKey(options.eventKey);
  return `${options.tokenId.toString()}-${buildPersistedReportEventKeyFragment(options.eventKey)}-${options.attestationArtifact.attestationHash}.json`;
}

export async function persistAuditAttestation(
  options: PersistAuditAttestationOptions
): Promise<PersistedAuditAttestationArtifact> {
  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "attestations"));
  const attestationFileName = buildAttestationFileName(options);
  const attestationFilePath = path.join(baseDir, attestationFileName);
  const tempFilePath = path.join(baseDir, `${attestationFileName}.${randomUUID()}.tmp`);

  await mkdir(baseDir, { recursive: true });
  await writeFile(tempFilePath, options.attestationArtifact.bundleJson, "utf8");

  try {
    await link(tempFilePath, attestationFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }

    const existing = await readFile(attestationFilePath, "utf8");
    if (existing !== options.attestationArtifact.bundleJson) {
      throw new Error(`attestation file conflict at ${attestationFilePath}`);
    }
  } finally {
    await rm(tempFilePath, { force: true });
  }

  return {
    attestationFilePath,
    attestationFileName,
    attestationHash: options.attestationArtifact.attestationHash
  };
}
