import { type FormEvent, useState } from "react";

import type { AppealClient, AppealSubmissionInput } from "../lib/appealClient";
import type { AuditRecord, ReputationRecordOnChain } from "../lib/agentAuditRegistryClient";
import { ReputationBadge } from "./ReputationBadge";
import { AppealHistoryTimeline, type AppealTimelineEntry } from "./AppealHistoryTimeline";

interface AppealSectionProps {
  auditRecord: AuditRecord;
  appealClient: AppealClient | null;
  tokenId: bigint;
  auditIndex: number;
  isAppealable: boolean;
  appealStatusLabel: string;
  onAppealSubmitted: () => void;
  reputation?: ReputationRecordOnChain;
  appealHistory?: AppealTimelineEntry[];
}

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; error: string }
  | { status: "submitted" };

export function AppealSection({
  auditRecord,
  appealClient,
  tokenId,
  auditIndex,
  isAppealable,
  appealStatusLabel,
  onAppealSubmitted,
  reputation,
  appealHistory
}: AppealSectionProps): JSX.Element {
  const [appealReason, setAppealReason] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    status: "idle"
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!appealClient) {
      return;
    }

    const trimmedReason = appealReason.trim();
    if (trimmedReason.length === 0) {
      setSubmissionState({ status: "error", error: "Appeal reason is required." });
      return;
    }

    setSubmissionState({ status: "submitting" });

    const input: AppealSubmissionInput = {
      tokenId,
      auditId: auditRecord.auditId as bigint,
      auditIndex,
      reason: trimmedReason,
      reportCID: auditRecord.reportCID,
      reportHash: auditRecord.reportHash,
      manifestUrl: auditRecord.manifestUrl
    };

    const result = await appealClient.submitAppeal(input);

    if (!result.ok) {
      setSubmissionState({ status: "error", error: result.error });
      return;
    }

    setSubmissionState({ status: "submitted" });
    setAppealReason("");
    onAppealSubmitted();
  }

  const isApproved =
    auditRecord.appealApproved || appealStatusLabel === "Appeal approved";
  const isRejected = appealStatusLabel === "Appeal rejected";
  const isInReview =
    auditRecord.appealRequested || appealStatusLabel === "Appeal in review";

  return (
    <section className="hero-card">
      <h2>Appeal</h2>

      {reputation ? (
        <ReputationBadge
          currentReputationScore={reputation.currentReputationScore}
          successfulAppeals={reputation.successfulAppeals}
          failedAppeals={reputation.failedAppeals}
          reputationDelta={reputation.reputationDelta}
        />
      ) : null}

      <div className="appeal-status-container">
        <span className="appeal-status-label">Status: {appealStatusLabel}</span>
      </div>
      {isApproved ? (
        <p className="intro">This slashed audit has already been compensated after review.</p>
      ) : isRejected ? (
        <p className="intro">This slashed audit appeal was rejected in review.</p>
      ) : isInReview || submissionState.status === "submitted" ? (
        <p className="intro">This slashed audit is already in appeal review.</p>
      ) : appealClient ? (
        <form className="appeal-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="appealReason">Appeal reason</label>
          <textarea
            id="appealReason"
            name="appealReason"
            value={appealReason}
            onChange={(event) => setAppealReason(event.target.value)}
            rows={5}
            placeholder="Explain why this slash should be reviewed."
          />
          {submissionState.status === "error" ? (
            <p role="alert">{submissionState.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={submissionState.status === "submitting" || !isAppealable}
          >
            {submissionState.status === "submitting" ? "Submitting..." : "Submit appeal"}
          </button>
        </form>
      ) : (
        <p className="intro">
          Appeal submission is unavailable because the frontend appeal endpoint is not configured.
        </p>
      )}

      {appealHistory && appealHistory.length > 0 ? (
        <AppealHistoryTimeline appeals={appealHistory} />
      ) : null}
    </section>
  );
}
