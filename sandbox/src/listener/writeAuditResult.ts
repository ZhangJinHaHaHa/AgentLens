import type { AuditWritebackSummary, ProcessedAuditRequested } from "./types";
import { ZERO_EVIDENCE_HASH } from "../evidence/buildAuditEvidenceEvent";

export interface WriteAuditResultDependencies {
  submitContractCall: (request: {
    method: "recordAuditResult";
    args: {
      tokenId: bigint;
      auditScore: number;
      memoryPeakMb: number;
      cpuAvgMilli: number;
      requestIpCount: number;
      status: 1 | 2;
      manifestHash: `0x${string}`;
      reportHash: `0x${string}`;
      evidenceRoot: `0x${string}`;
      attestationHash: `0x${string}`;
      evidenceCID: string;
      reportCID: string;
      manifestUrl: string;
    };
  }) => Promise<unknown>;
}

function mapAuditStatus(status: AuditWritebackSummary["status"]): 1 | 2 {
  return status === "Passed" ? 1 : 2;
}

function normalizeBytes32(value: string): `0x${string}` {
  if (value.startsWith("0x")) {
    return value as `0x${string}`;
  }

  return `0x${value}`;
}

export async function writeAuditResult(
  processed: ProcessedAuditRequested,
  deps: WriteAuditResultDependencies
): Promise<unknown> {
  return writeAuditResultSummary(processed.writeback, deps);
}

export async function writeAuditResultSummary(
  summary: AuditWritebackSummary,
  deps: WriteAuditResultDependencies
): Promise<unknown> {
  return deps.submitContractCall({
    method: "recordAuditResult",
    args: {
      tokenId: summary.tokenId,
      auditScore: summary.auditScore,
      memoryPeakMb: summary.memoryPeakMb,
      cpuAvgMilli: summary.cpuAvgMilli,
      requestIpCount: summary.requestIpCount,
      status: mapAuditStatus(summary.status),
      manifestHash: normalizeBytes32(summary.manifestHash),
      reportHash: normalizeBytes32(summary.reportHash),
      evidenceRoot: normalizeBytes32(summary.evidenceRoot ?? ZERO_EVIDENCE_HASH),
      attestationHash: normalizeBytes32(summary.attestationHash ?? ZERO_EVIDENCE_HASH),
      evidenceCID: summary.evidenceCID ?? "",
      reportCID: summary.reportCID,
      manifestUrl: summary.manifestUrl
    }
  });
}
