import type { AgentCatalogEntry, AgentChainEvidence, TrustTier } from "./catalog";
import { isNonZeroHash } from "@/lib/chainEvidence";

/**
 * Reputation threshold the chain evidence must clear before we promote an
 * agent to Tier 3. The v2 contract reports reputation in 0..1000.
 */
export const REPUTATION_TIER3_THRESHOLD = 600;

export type TrustTierReasonKey =
  | "hasObservation"
  | "hasAuditPassed"
  | "hasAttestationHash"
  | "hasReportHash"
  | "hasReputation"
  | "noEvidence";

export interface TrustTierEvidenceItem {
  key: string;
  /** Translation key under `tiers.evidence.*`. Optional — falls back to value. */
  labelKey?: string;
  value: string;
}

export interface TrustTierResult {
  tier: TrustTier;
  reasons: TrustTierReasonKey[];
  evidence: TrustTierEvidenceItem[];
}

interface TrustTierInput {
  entry: AgentCatalogEntry;
  /**
   * Optional override for chain evidence (lets the detail page feed fresher
   * data than what was merged into the catalog at load time).
   */
  chainEvidence?: AgentChainEvidence;
}

export function computeTrustTier({ entry, chainEvidence }: TrustTierInput): TrustTierResult {
  const reasons: TrustTierReasonKey[] = [];
  const evidence: TrustTierEvidenceItem[] = [];

  const chain = chainEvidence ?? entry.chainEvidence;
  const hasObservation = Boolean(entry.latestObservedAt && entry.observationSummary);

  const hasAuditPassed = Boolean(chain?.auditPassed);
  const hasReportHash = isNonZeroHash(chain?.reportHash);
  const hasAttestationHash = isNonZeroHash(chain?.attestationHash);
  const reputation = chain?.reputationScore ?? 0;
  const hasReputation = reputation >= REPUTATION_TIER3_THRESHOLD;

  if (hasObservation) {
    reasons.push("hasObservation");
    if (entry.latestObservedAt) {
      evidence.push({
        key: "observedAt",
        labelKey: "tiers.evidence.observedAt",
        value: entry.latestObservedAt
      });
    }
  }

  if (hasAuditPassed) {
    reasons.push("hasAuditPassed");
    evidence.push({ key: "auditPassed", labelKey: "tiers.evidence.auditPassed", value: "passed" });
  }
  if (hasReportHash && chain?.reportHash) {
    reasons.push("hasReportHash");
    evidence.push({
      key: "reportHash",
      labelKey: "tiers.evidence.reportHash",
      value: chain.reportHash
    });
  }
  if (hasAttestationHash && chain?.attestationHash) {
    reasons.push("hasAttestationHash");
    evidence.push({
      key: "attestationHash",
      labelKey: "tiers.evidence.attestationHash",
      value: chain.attestationHash
    });
  }
  if (hasReputation) {
    reasons.push("hasReputation");
    evidence.push({
      key: "reputation",
      labelKey: "tiers.evidence.reputation",
      value: String(reputation)
    });
  }

  let tier: TrustTier = 0;

  if (hasAuditPassed && hasReportHash && hasAttestationHash && hasReputation) {
    tier = 3;
  } else if (hasAuditPassed || hasAttestationHash) {
    tier = 2;
  } else if (hasObservation) {
    tier = 1;
  }

  // Editorial override (`trustTierHint`) can DOWNGRADE only — promoting via a
  // hint would let curated entries claim Tier 3 without chain evidence, which
  // is exactly the misuse Sprint 1.2 explicitly forbids.
  if (typeof entry.trustTierHint === "number" && entry.trustTierHint < tier) {
    tier = entry.trustTierHint;
  }

  if (reasons.length === 0) {
    reasons.push("noEvidence");
  }

  return { tier, reasons, evidence };
}

export function tierLabelKey(tier: TrustTier): string {
  return `labels.tier${tier}`;
}

export function tierShortLabelKey(tier: TrustTier): string {
  return `shortLabels.tier${tier}`;
}

export function tierDescriptionKey(tier: TrustTier): string {
  return `descriptions.tier${tier}`;
}
