import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AuditQuestionsSection } from "../components/AuditQuestionsSection";
import { EmptyState } from "../components/EmptyState";
import { EvidenceInfo } from "../components/EvidenceInfo";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { NavHeader } from "../components/NavHeader";
import { RawJsonViewer } from "../components/RawJsonViewer";
import { SandboxExecutionSummary } from "../components/SandboxExecutionSummary";
import { SecurityBoundaryCard } from "../components/SecurityBoundaryCard";
import { DimensionalScoreCard } from "../components/DimensionalScoreCard";
import type { DimensionalScoreData } from "../components/RadarScoreChart";
import type { AppConfig } from "../config/appConfig";
import { createAgentAuditRegistryClient, type AgentAuditRegistryReadContract, type AuditRecord } from "../lib/agentAuditRegistryClient";
import {
  createAppealSubmissionClient,
  type AppealClient
} from "../lib/appealClient";
import {
  createAuditReportClient,
  type AuditReportClient,
  type AuditReportReadErrorCode,
  type AuditReportReadResult
} from "../lib/auditReportClient";
import { getAuditStatusLabel, AUDIT_STATUS_SLASHED } from "../lib/auditStatus";
import { getErrorMessage, normalizeContractReadError } from "../lib/normalizeContractReadError";
import { parseTokenIdInput } from "../lib/tokenId";

interface AuditReportPageProps {
  config: AppConfig;
  client?: AgentAuditRegistryReadContract;
  reportClient?: AuditReportClient;
  appealClient?: AppealClient;
}

type PageState =
  | { status: "loading" }
  | {
      status: "ready";
      auditRecord: AuditRecord;
      reportResult: Extract<AuditReportReadResult, { ok: true }> | null;
      reportUnavailableMessage: string | null;
    }
  | { status: "audit-error"; title: string; description: string }
  | { status: "report-error"; title: string; description: string };

export function AuditReportPage({
  config,
  client,
  reportClient,
  appealClient
}: AuditReportPageProps): JSX.Element {
  const { tokenId = "", auditId = "", auditIndex = "" } = useParams();
  const parsedTokenId = parseTokenIdInput(tokenId);
  const parsedAuditId = parseTokenIdInput(auditId);
  const parsedAuditIndex = parseTokenIdInput(auditIndex);
  const validTokenId = parsedTokenId.ok ? parsedTokenId.value : null;
  const validAuditId = parsedAuditId.ok ? parsedAuditId.value : null;
  const validAuditIndex =
    parsedAuditIndex.ok && Number.isSafeInteger(Number(parsedAuditIndex.value))
      ? Number(parsedAuditIndex.value)
      : null;
  const [resolvedClient] = useState<AgentAuditRegistryReadContract>(
    () => client ?? createAgentAuditRegistryClient(config)
  );
  const [resolvedReportClient] = useState<AuditReportClient>(
    () =>
      reportClient ??
      createAuditReportClient({
        gatewayBaseUrl: config.reportGatewayUrl
      })
  );
  const [resolvedAppealClient] = useState<AppealClient | null>(
    () =>
      appealClient ??
      (config.appealApiUrl
        ? createAppealSubmissionClient({
            endpointUrl: config.appealApiUrl
          })
        : null)
  );
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmissionState, setAppealSubmissionState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "error"; error: string }
    | { status: "submitted" }
  >({ status: "idle" });
  const [appealStatusOverride, setAppealStatusOverride] = useState<{
    appealRequested: boolean;
    appealApproved: boolean;
  } | null>(null);
  const [appealApiStatus, setAppealApiStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (validTokenId === null || validAuditId === null || validAuditIndex === null) {
      setState({
        status: "audit-error",
        title: "Invalid audit route",
        description: "The route must include decimal tokenId, auditId, and audit index values."
      });
      return;
    }

    if (validAuditIndex < 0) {
      setState({
        status: "audit-error",
        title: "Invalid audit route",
        description: "The audit index must be a non-negative safe integer."
      });
      return;
    }

    const resolvedTokenId = validTokenId;
    const resolvedAuditId = validAuditId;
    const resolvedAuditIndex = validAuditIndex;

    setState({ status: "loading" });
    setAppealReason("");
    setAppealSubmissionState({ status: "idle" });
    setAppealStatusOverride(null);
    setAppealApiStatus(null);

    async function loadAuditReport(): Promise<void> {
      try {
        const auditRecord = await resolvedClient.getAuditReportByIndex(
          resolvedTokenId,
          resolvedAuditIndex
        );

        if (cancelled) {
          return;
        }

        if (String(auditRecord.auditId) !== String(resolvedAuditId)) {
          setState({
            status: "audit-error",
            title: "Audit not found",
            description: "The requested audit route does not match the on-chain history entry."
          });
          return;
        }

        const reportResult = await resolvedReportClient.readReportByCid({
          reportCID: auditRecord.reportCID,
          expectedReportHash: auditRecord.reportHash
        });

        if (cancelled) {
          return;
        }

        if (!reportResult.ok) {
          if (reportResult.errorCode === "REPORT_UNAVAILABLE") {
            if (
              resolvedAppealClient &&
              Number(auditRecord.status) === AUDIT_STATUS_SLASHED &&
              !auditRecord.appealRequested &&
              !auditRecord.appealApproved
            ) {
              const latestAppeal = await resolvedAppealClient.readLatestAppeal({
                tokenId: resolvedTokenId,
                auditId: auditRecord.auditId as bigint
              });

              if (cancelled) {
                return;
              }

              if (latestAppeal.ok) {
                setAppealApiStatus(latestAppeal.status);
                setAppealStatusOverride(mapAppealApiStatus(latestAppeal.status));
              }
            }

            setState({
              status: "ready",
              auditRecord,
              reportResult: null,
              reportUnavailableMessage: reportResult.error
            });
            return;
          }

          setState({
            status: "report-error",
            title: mapReportErrorTitle(reportResult.errorCode),
            description: reportResult.error
          });
          return;
        }

        if (
          resolvedAppealClient &&
          Number(auditRecord.status) === AUDIT_STATUS_SLASHED &&
          !auditRecord.appealRequested &&
          !auditRecord.appealApproved
        ) {
          const latestAppeal = await resolvedAppealClient.readLatestAppeal({
            tokenId: resolvedTokenId,
            auditId: auditRecord.auditId as bigint
          });

          if (cancelled) {
            return;
          }

          if (latestAppeal.ok) {
            setAppealApiStatus(latestAppeal.status);
            setAppealStatusOverride(mapAppealApiStatus(latestAppeal.status));
          }
        }

        setState({
          status: "ready",
          auditRecord,
          reportResult,
          reportUnavailableMessage: null
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const errorCode = normalizeContractReadError(error);
        setState({
          status: "audit-error",
          title:
            errorCode === "TOKEN_NOT_FOUND" || errorCode === "INDEX_OUT_OF_BOUNDS"
              ? "Audit not found"
              : "Unable to load audit report",
          description: getErrorMessage(error)
        });
      }
    }

    void loadAuditReport();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedClient,
    resolvedAppealClient,
    resolvedReportClient,
    validAuditId,
    validAuditIndex,
    validTokenId
  ]);

  if (state.status === "loading") {
    return (
      <main className="app-shell-full">
        <NavHeader backHref={`/agent/${tokenId}`} backLabel="Agent detail" />
        <div className="page-content">
          <LoadingSkeleton lines={4} title="Loading audit summary" />
          <LoadingSkeleton lines={6} title="Loading report body" />
        </div>
      </main>
    );
  }

  if (state.status === "audit-error" || state.status === "report-error") {
    return (
      <main className="app-shell-full">
        <NavHeader backHref={`/agent/${tokenId}`} backLabel="Agent detail" />
        <div className="page-content">
          <EmptyState title={state.title} description={state.description} />
        </div>
      </main>
    );
  }

  const { auditRecord, reportResult, reportUnavailableMessage } = state;
  const verifiedReport = reportResult?.report;
  const effectiveAuditRecord =
    appealSubmissionState.status === "submitted"
      ? {
          ...auditRecord,
          appealRequested: true
        }
      : appealStatusOverride
      ? {
          ...auditRecord,
          ...appealStatusOverride
        }
      : auditRecord;
  const isAppealable =
    Number(auditRecord.status) === AUDIT_STATUS_SLASHED &&
    appealApiStatus !== "rejected" &&
    !effectiveAuditRecord.appealRequested &&
    !effectiveAuditRecord.appealApproved;
  const appealStatusLabel = getAppealStatusLabel(effectiveAuditRecord, appealApiStatus);

  async function handleAppealSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!resolvedAppealClient) {
      return;
    }

    const trimmedReason = appealReason.trim();
    if (trimmedReason.length === 0) {
      setAppealSubmissionState({
        status: "error",
        error: "Appeal reason is required."
      });
      return;
    }

    setAppealSubmissionState({ status: "submitting" });

    const result = await resolvedAppealClient.submitAppeal({
      tokenId: validTokenId ?? 0n,
      auditId: auditRecord.auditId as bigint,
      auditIndex: validAuditIndex ?? 0,
      reason: trimmedReason,
      reportCID: auditRecord.reportCID,
      reportHash: auditRecord.reportHash,
      manifestUrl: auditRecord.manifestUrl
    });

    if (!result.ok) {
      setAppealSubmissionState({
        status: "error",
        error: result.error
      });
      return;
    }

    setAppealSubmissionState({ status: "submitted" });
    setAppealReason("");
  }

  const statusLabel = getAuditStatusLabel(auditRecord.status);
  const statusClass = `status-badge status-badge--${statusLabel.toLowerCase()}`;

  return (
    <main className="app-shell-full">
      <NavHeader backHref={`/agent/${tokenId}`} backLabel="Agent detail" />
      <div className="page-content">
        <section className="hero-card">
          <p className="eyebrow">Detailed audit report</p>
          <h1>{`Audit report #${String(auditRecord.auditId)}`}</h1>
          <p className="intro">
            {reportResult
              ? "Hash verified. The detailed JSON matches the on-chain summary hash."
              : "Detailed report is unavailable for this audit summary. On-chain fields are still readable."}
          </p>
        </section>

        <section className="hero-card">
          <h2>On-chain summary</h2>
          <dl className="detail-grid">
            <div>
              <dt>Audit ID</dt>
              <dd>{String(auditRecord.auditId)}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{String(auditRecord.timestamp)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className={statusClass}>{verifiedReport?.status ?? statusLabel}</span></dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd>{verifiedReport?.decisionType ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Score</dt>
              <dd>{String(auditRecord.auditScore)}</dd>
            </div>
            <div>
              <dt>Appeal status</dt>
              <dd>{appealStatusLabel}</dd>
            </div>
          </dl>
        </section>

        <EvidenceInfo
          reportHash={auditRecord.reportHash}
          reportCID={auditRecord.reportCID}
          manifestHash={verifiedReport?.manifestHash ?? auditRecord.manifestHash}
          manifestUrl={auditRecord.manifestUrl}
          hashVerified={reportResult !== null}
          sourceUrl={reportResult?.sourceUrl}
        />

        {verifiedReport ? (
          <>
            <section className="hero-card">
              <h2>Report body</h2>
              <dl className="detail-grid">
                <div>
                  <dt>Agent name</dt>
                  <dd>{verifiedReport.agentName}</dd>
                </div>
                <div>
                  <dt>Healthcheck</dt>
                  <dd>
                    <span className={verifiedReport.healthcheckPassed ? "badge-safe" : "badge-danger"}>
                      {verifiedReport.healthcheckPassed ? "Passed" : "Failed"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Reason code</dt>
                  <dd>{verifiedReport.reasonCode ?? "None"}</dd>
                </div>
              </dl>
            </section>

            <SandboxExecutionSummary report={verifiedReport} />

            {verifiedReport.dimensionalScores ? (
              <DimensionalScoreCard
                scores={verifiedReport.dimensionalScores.dimensions as DimensionalScoreData}
                overallScore={verifiedReport.dimensionalScores.overallScore}
              />
            ) : null}

            {verifiedReport.securityBoundaryScore ? (
              <SecurityBoundaryCard boundary={verifiedReport.securityBoundaryScore} />
            ) : null}

            {verifiedReport.auditQuestions && verifiedReport.auditQuestions.length > 0 ? (
              <AuditQuestionsSection
                questions={verifiedReport.auditQuestions}
                evaluations={verifiedReport.answerEvaluations}
              />
            ) : null}

            <section className="hero-card">
              <h2>Response</h2>
              <p className="report-answer">{verifiedReport.responseTrace.answer}</p>
            </section>

            <section className="hero-card">
              <h2>Declared actions</h2>
              <ul className="history-list">
                {verifiedReport.responseTrace.actions.map((action, index) => (
                  <li key={`${action.type}-${index}`} className="action-item">
                    <span className="action-type">{action.type}</span>
                    {"url" in action && typeof action.url === "string" ? (
                      <span className="action-url">{action.url}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            {reportResult?.reportJson ? (
              <RawJsonViewer json={reportResult.reportJson} title="Raw report JSON" />
            ) : null}
          </>
        ) : (
          <section className="hero-card">
            <h2>Report body</h2>
            <p>{reportUnavailableMessage ?? "Detailed report is unavailable."}</p>
          </section>
        )}

        {Number(auditRecord.status) === AUDIT_STATUS_SLASHED ? (
          <section className="hero-card">
            <h2>Submit appeal</h2>
            {effectiveAuditRecord.appealApproved ? (
              <p className="intro">This slashed audit has already been compensated after review.</p>
            ) : appealApiStatus === "rejected" ? (
              <p className="intro">This slashed audit appeal was rejected in review.</p>
            ) : effectiveAuditRecord.appealRequested ? (
              <p className="intro">This slashed audit is already in appeal review.</p>
            ) : resolvedAppealClient ? (
              <form className="appeal-form" onSubmit={(event) => void handleAppealSubmit(event)}>
                <label htmlFor="appealReason">Appeal reason</label>
                <textarea
                  id="appealReason"
                  name="appealReason"
                  value={appealReason}
                  onChange={(event) => setAppealReason(event.target.value)}
                  rows={5}
                  placeholder="Explain why this slash should be reviewed."
                />
                {appealSubmissionState.status === "error" ? (
                  <p role="alert">{appealSubmissionState.error}</p>
                ) : null}
                {appealSubmissionState.status === "submitted" ? (
                  <p>Appeal submitted. Review is now pending.</p>
                ) : null}
                <button type="submit" disabled={appealSubmissionState.status === "submitting" || !isAppealable}>
                  {appealSubmissionState.status === "submitting" ? "Submitting..." : "Submit appeal"}
                </button>
              </form>
            ) : (
              <p className="intro">
                Appeal submission is unavailable because the frontend appeal endpoint is not configured.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function mapReportErrorTitle(errorCode: AuditReportReadErrorCode): string {
  switch (errorCode) {
    case "HASH_MISMATCH":
      return "Report verification failed";
    case "REPORT_UNAVAILABLE":
      return "Report unavailable";
    default:
      return "Unable to load report";
  }
}

function getAppealStatusLabel(auditRecord: AuditRecord, appealApiStatus?: string | null): string {
  if (appealApiStatus?.toLowerCase() === "rejected") {
    return "Appeal rejected";
  }

  if (auditRecord.appealApproved) {
    return "Appeal approved";
  }

  if (auditRecord.appealRequested) {
    return "Appeal in review";
  }

  return "No appeal";
}

function mapAppealApiStatus(status: string): {
  appealRequested: boolean;
  appealApproved: boolean;
} {
  if (status.toLowerCase() === "rejected") {
    return {
      appealRequested: false,
      appealApproved: false
    };
  }

  if (status.toLowerCase() === "approved") {
    return {
      appealRequested: true,
      appealApproved: true
    };
  }

  return {
    appealRequested: true,
    appealApproved: false
  };
}
