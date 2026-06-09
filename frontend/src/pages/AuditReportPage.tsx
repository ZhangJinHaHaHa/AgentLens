import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuditReportSummary } from "@/components/trust/AuditReportSummary";
import { AuditDimensionRadar, type AuditDimensionRadarItem } from "@/components/trust/AuditDimensionRadar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppConfig } from "@/config/appConfig";
import { summarizeAuditReport } from "@/domain/auditReportSummary";
import { useLocale } from "@/i18n/useLocale";
import {
  createAgentAuditRegistryClient,
  type AgentAuditRegistryReadContract,
  type AuditRecord
} from "@/lib/agentAuditRegistryClient";
import {
  createAppealSubmissionClient,
  type AppealClient
} from "@/lib/appealClient";
import {
  createAuditReportClient,
  type AnswerEvaluationMeta,
  type AuditQuestionMeta,
  type AuditReportClient,
  type AuditReportReadErrorCode,
  type AuditReportReadResult,
  type DetailedAuditReport,
  type SecurityBoundaryMeta
} from "@/lib/auditReportClient";
import { AUDIT_STATUS_SLASHED, getAuditStatusLabel } from "@/lib/auditStatus";
import { isAttestationPresent } from "@/lib/chainEvidence";
import { formatTimestamp } from "@/lib/format";
import { getErrorMessage, normalizeContractReadError } from "@/lib/normalizeContractReadError";
import { parseTokenIdInput } from "@/lib/tokenId";
import { cn } from "@/lib/utils";

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
      auditIndex: number;
      reportResult: Extract<AuditReportReadResult, { ok: true }> | null;
      reportUnavailableMessage: string | null;
    }
  | { status: "audit-error" | "report-error"; title: string; description: string };

function statusVariant(status: bigint | number): "default" | "secondary" | "danger" | "outline" {
  const label = getAuditStatusLabel(status).toLowerCase();
  if (label === "passed" || label === "compensated") return "default";
  if (label === "pending") return "secondary";
  if (label === "failed" || label === "slashed") return "danger";
  return "outline";
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

function mapAppealApiStatus(status: string): {
  appealRequested: boolean;
  appealApproved: boolean;
} {
  if (status.toLowerCase() === "rejected") {
    return { appealRequested: false, appealApproved: false };
  }
  if (status.toLowerCase() === "approved") {
    return { appealRequested: true, appealApproved: true };
  }
  return { appealRequested: true, appealApproved: false };
}

function getAppealStatusLabel(auditRecord: AuditRecord, appealApiStatus?: string | null): string {
  if (appealApiStatus?.toLowerCase() === "rejected") return "Appeal rejected";
  if (auditRecord.appealApproved) return "Appeal approved";
  if (auditRecord.appealRequested) return "Appeal in review";
  return "No appeal";
}

export function AuditReportPage({
  config,
  client,
  reportClient,
  appealClient
}: AuditReportPageProps): JSX.Element {
  const { id = "", auditId = "", auditIndex = "" } = useParams<{
    id: string;
    auditId: string;
    auditIndex: string;
  }>();
  const { buildPath } = useLocale();
  const { t } = useTranslation("report");
  const parsedTokenId = parseTokenIdInput(id);
  const parsedAuditIndex = parseTokenIdInput(auditIndex);
  const parsedAuditId = auditId === "latest" ? null : parseTokenIdInput(auditId);
  const auditIdIsLatest = auditId === "latest";
  const validTokenId = parsedTokenId.ok ? parsedTokenId.value : null;
  const validAuditIndex =
    parsedAuditIndex.ok && Number.isSafeInteger(Number(parsedAuditIndex.value))
      ? Number(parsedAuditIndex.value)
      : null;
  const auditIdIsValid = auditIdIsLatest || Boolean(parsedAuditId?.ok);
  const expectedAuditId = parsedAuditId?.ok ? parsedAuditId.value : null;

  const [resolvedClient] = useState<AgentAuditRegistryReadContract>(
    () => client ?? createAgentAuditRegistryClient(config)
  );
  const [resolvedReportClient] = useState<AuditReportClient>(
    () => reportClient ?? createAuditReportClient({ gatewayBaseUrl: config.reportGatewayUrl })
  );
  const [resolvedAppealClient] = useState<AppealClient | null>(
    () =>
      appealClient ??
      (config.appealApiUrl
        ? createAppealSubmissionClient({ endpointUrl: config.appealApiUrl })
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

    if (validTokenId === null || validAuditIndex === null || validAuditIndex < 0) {
      setState({
        status: "audit-error",
        title: "Invalid audit route",
        description: "The route must include a numeric token id and a non-negative audit index."
      });
      return;
    }

    if (!auditIdIsValid) {
      setState({
        status: "audit-error",
        title: "Invalid audit route",
        description: "The audit id must be a decimal value or the literal latest."
      });
      return;
    }

    const resolvedTokenId = validTokenId;
    let resolvedAuditIndex = validAuditIndex;

    setState({ status: "loading" });
    setAppealReason("");
    setAppealSubmissionState({ status: "idle" });
    setAppealStatusOverride(null);
    setAppealApiStatus(null);

    async function loadAuditReport(): Promise<void> {
      try {
        if (auditIdIsLatest) {
          const auditCount = Number(await resolvedClient.getAuditCount(resolvedTokenId));
          if (!Number.isSafeInteger(auditCount) || auditCount <= 0) {
            setState({
              status: "audit-error",
              title: "Audit not found",
              description: "This agent has no audit records yet."
            });
            return;
          }
          resolvedAuditIndex = auditCount - 1;
        }

        const auditRecord = await resolvedClient.getAuditReportByIndex(
          resolvedTokenId,
          resolvedAuditIndex
        );

        if (cancelled) return;

        if (expectedAuditId !== null && BigInt(auditRecord.auditId) !== expectedAuditId) {
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

        if (cancelled) return;

        if (
          resolvedAppealClient &&
          Number(auditRecord.status) === AUDIT_STATUS_SLASHED &&
          !auditRecord.appealRequested &&
          !auditRecord.appealApproved
        ) {
          const latestAppeal = await resolvedAppealClient.readLatestAppeal({
            tokenId: resolvedTokenId,
            auditId: BigInt(auditRecord.auditId)
          });

          if (cancelled) return;

          if (latestAppeal.ok) {
            setAppealApiStatus(latestAppeal.status);
            setAppealStatusOverride(mapAppealApiStatus(latestAppeal.status));
          }
        }

        if (!reportResult.ok) {
          if (reportResult.errorCode === "REPORT_UNAVAILABLE") {
            setState({
              status: "ready",
              auditRecord,
              auditIndex: resolvedAuditIndex,
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

        setState({
          status: "ready",
          auditRecord,
          auditIndex: resolvedAuditIndex,
          reportResult,
          reportUnavailableMessage: null
        });
      } catch (error) {
        if (cancelled) return;

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
    auditId,
    auditIdIsLatest,
    auditIdIsValid,
    expectedAuditId,
    resolvedAppealClient,
    resolvedClient,
    resolvedReportClient,
    validAuditIndex,
    validTokenId
  ]);

  if (state.status === "loading") {
    return (
      <section className="container-page flex flex-col gap-4 py-12">
        <Skeleton className="h-32" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </section>
    );
  }

  if (state.status === "audit-error" || state.status === "report-error") {
    return (
      <section className="container-page py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to={buildPath(`/agent/${id}`)}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("back")}
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{state.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{state.description}</CardContent>
        </Card>
      </section>
    );
  }

  if (state.status !== "ready") {
    return <></>;
  }

  const { auditRecord, auditIndex: resolvedAuditIndex, reportResult, reportUnavailableMessage } = state;
  const verifiedReport = reportResult?.report ?? null;
  const effectiveAuditRecord =
    appealSubmissionState.status === "submitted"
      ? { ...auditRecord, appealRequested: true }
      : appealStatusOverride
        ? { ...auditRecord, ...appealStatusOverride }
        : auditRecord;
  const appealStatusLabel = getAppealStatusLabel(effectiveAuditRecord, appealApiStatus);
  const isAppealable =
    Number(auditRecord.status) === AUDIT_STATUS_SLASHED &&
    appealApiStatus !== "rejected" &&
    !effectiveAuditRecord.appealRequested &&
    !effectiveAuditRecord.appealApproved;
  const summary = summarizeAuditReport({
    auditRecord: effectiveAuditRecord,
    report: verifiedReport,
    hashVerified: Boolean(reportResult),
    reportUnavailableMessage,
    attestationConfig: config.attestation
  });

  async function handleAppealSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!resolvedAppealClient || validTokenId === null) return;

    const trimmedReason = appealReason.trim();
    if (trimmedReason.length === 0) {
      setAppealSubmissionState({ status: "error", error: "Appeal reason is required." });
      return;
    }

    setAppealSubmissionState({ status: "submitting" });

    const result = await resolvedAppealClient.submitAppeal({
      tokenId: validTokenId,
      auditId: BigInt(auditRecord.auditId),
      auditIndex: resolvedAuditIndex,
      reason: trimmedReason,
      reportCID: auditRecord.reportCID,
      reportHash: auditRecord.reportHash,
      manifestUrl: auditRecord.manifestUrl
    });

    if (!result.ok) {
      setAppealSubmissionState({ status: "error", error: result.error });
      return;
    }

    setAppealSubmissionState({ status: "submitted" });
    setAppealReason("");
  }

  return (
    <section className="container-page flex flex-col gap-6 py-12">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to={buildPath(`/agent/${id}`)}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {t("back")}
        </Link>
      </Button>

      <AuditReportSummary summary={summary} />

      <details className="surface-card">
        <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-foreground">
          {t("technical.title")}
        </summary>
        <div className="flex flex-col gap-6 px-4 pb-4 sm:px-6 sm:pb-6">
          <OnChainSummary auditRecord={auditRecord} decision={verifiedReport?.decisionType} appealStatus={appealStatusLabel} />

          <EvidenceCard
            auditRecord={auditRecord}
            manifestHash={verifiedReport?.manifestHash ?? auditRecord.manifestHash}
            sourceUrl={reportResult?.sourceUrl}
            hashVerified={Boolean(reportResult)}
          />

          <AttestationCard attestationHash={auditRecord.attestationHash} expected={config.attestation} />

          {verifiedReport ? (
            <>
              <ReportBodyCard report={verifiedReport} />
              {verifiedReport.dimensionalScores ? <DimensionalScoresCard report={verifiedReport} /> : null}
              {verifiedReport.securityBoundaryScore ? (
                <SecurityBoundaryCard boundary={verifiedReport.securityBoundaryScore} />
              ) : null}
              {verifiedReport.auditQuestions && verifiedReport.auditQuestions.length > 0 ? (
                <AuditQuestionsCard
                  questions={verifiedReport.auditQuestions}
                  evaluations={verifiedReport.answerEvaluations ?? []}
                />
              ) : null}
              <ResponseTraceCard report={verifiedReport} />
              {reportResult?.reportJson ? <RawJsonCard json={reportResult.reportJson} /> : null}
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("technical.reportBody")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {reportUnavailableMessage ?? t("technical.unavailable")}
              </CardContent>
            </Card>
          )}
        </div>
      </details>

      {Number(auditRecord.status) === AUDIT_STATUS_SLASHED ? (
        <AppealCard
          auditRecord={effectiveAuditRecord}
          appealApiStatus={appealApiStatus}
          appealReason={appealReason}
          onAppealReasonChange={setAppealReason}
          onSubmit={handleAppealSubmit}
          appealSubmissionState={appealSubmissionState}
          isAppealable={isAppealable}
          configured={Boolean(resolvedAppealClient)}
        />
      ) : null}
    </section>
  );
}

function OnChainSummary({
  auditRecord,
  decision,
  appealStatus
}: {
  auditRecord: AuditRecord;
  decision?: string;
  appealStatus: string;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>On-chain summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm md:grid-cols-3">
          <Meta label="Audit ID" value={String(auditRecord.auditId)} />
          <Meta label="Timestamp" value={formatTimestamp(auditRecord.timestamp)} />
          <Meta label="Status" value={getAuditStatusLabel(auditRecord.status)} />
          <Meta label="Decision" value={decision ?? "Unavailable"} />
          <Meta label="Score" value={String(Number(auditRecord.auditScore))} />
          <Meta label="Appeal status" value={appealStatus} />
        </dl>
      </CardContent>
    </Card>
  );
}

function EvidenceCard({
  auditRecord,
  manifestHash,
  sourceUrl,
  hashVerified
}: {
  auditRecord: AuditRecord;
  manifestHash: string;
  sourceUrl?: string;
  hashVerified: boolean;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-4 w-4" aria-hidden />
          Evidence
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <Meta label="Report hash" value={auditRecord.reportHash || "—"} mono />
          <Meta label="Report CID" value={auditRecord.reportCID || "—"} mono />
          <Meta label="Manifest hash" value={manifestHash || "—"} mono />
          <Meta label="Manifest URL" value={auditRecord.manifestUrl || "—"} mono />
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={hashVerified ? "success" : "secondary"}>
            {hashVerified ? "Detailed JSON verified" : "Detailed JSON unavailable"}
          </Badge>
          {sourceUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                Open source
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AttestationCard({
  attestationHash,
  expected
}: {
  attestationHash?: string;
  expected?: AppConfig["attestation"];
}): JSX.Element {
  const attested = isAttestationPresent(attestationHash);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          TEE attestation
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          {attested
            ? "The audit includes an attestation hash. The listener accepted the quote according to its configured policy."
            : "This audit was recorded without a non-zero attestation hash."}
        </p>
        <dl className="grid gap-4 md:grid-cols-2">
          <Meta label="Attestation hash" value={attestationHash || "—"} mono />
          {expected?.expectedProviderType ? <Meta label="Pinned provider" value={expected.expectedProviderType} mono /> : null}
          {expected?.expectedMeasurement ? <Meta label="Pinned measurement" value={expected.expectedMeasurement} mono /> : null}
          {expected?.expectedQuoteFormat ? <Meta label="Pinned quote format" value={expected.expectedQuoteFormat} mono /> : null}
        </dl>
        {expected?.verifyReportDataBinding ? (
          <Badge variant="success" className="w-fit">report_data binding enforced</Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReportBodyCard({ report }: { report: DetailedAuditReport }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Report body</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm md:grid-cols-3">
          <Meta label="Agent" value={report.agentName} />
          <Meta label="Schema" value={report.schemaVersion} />
          <Meta label="Decision" value={report.decisionType} />
          <Meta label="Healthcheck" value={report.healthcheckPassed ? "Passed" : "Failed"} />
          <Meta label="Reason code" value={report.reasonCode ?? "None"} />
          <Meta label="Window" value={`${report.timestamps.startedAt} -> ${report.timestamps.finishedAt}`} />
        </dl>
      </CardContent>
    </Card>
  );
}

function DimensionalScoresCard({ report }: { report: DetailedAuditReport }): JSX.Element {
  if (!report.dimensionalScores) return <></>;
  const scores = report.dimensionalScores.dimensions;
  const rows: AuditDimensionRadarItem[] = [
    { key: "security", label: "Security", value: scores.security },
    { key: "task_execution", label: "Task execution", value: scores.task_execution },
    { key: "cognitive", label: "Cognitive", value: scores.cognitive },
    { key: "environment", label: "Environment", value: scores.environment },
    { key: "engineering", label: "Engineering", value: scores.engineering },
    { key: "compliance", label: "Compliance", value: scores.compliance }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Capability assessment</CardTitle>
          <Badge variant="secondary">Overall {report.dimensionalScores.overallScore}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <AuditDimensionRadar items={rows} />
      </CardContent>
    </Card>
  );
}

function SecurityBoundaryCard({ boundary }: { boundary: SecurityBoundaryMeta }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security boundary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Score" value={String(boundary.score)} />
          <Metric label="Auth boundary" value={boundary.hasAuthBoundary ? "Present" : "Missing"} />
          <Metric label="Privilege resistance" value={boundary.privilegeEscalationResistant ? "Passed" : "Weak"} />
        </div>
        {boundary.flags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {boundary.flags.map((flag) => <Badge key={flag} variant="danger">{flag}</Badge>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AuditQuestionsCard({
  questions,
  evaluations
}: {
  questions: AuditQuestionMeta[];
  evaluations: AnswerEvaluationMeta[];
}): JSX.Element {
  const evaluationById = new Map(evaluations.map((item) => [item.questionId, item]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit questions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {questions.map((question) => {
          const evaluation = evaluationById.get(question.id);
          return (
            <div key={question.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{question.category}</Badge>
                {evaluation ? (
                  <Badge variant={evaluation.passed ? "success" : "danger"}>
                    {evaluation.passed ? "Passed" : "Failed"} · {evaluation.score}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-foreground">{question.question}</p>
              <p className="mt-2 text-xs text-muted-foreground">{question.expectedBehavior}</p>
              {evaluation?.reasoning ? (
                <p className="mt-3 text-sm text-muted-foreground">{evaluation.reasoning}</p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ResponseTraceCard({ report }: { report: DetailedAuditReport }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Response trace</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md border border-border bg-muted p-4 text-sm whitespace-pre-wrap">
          {report.responseTrace.answer || "No answer captured."}
        </div>
        {report.responseTrace.actions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Declared actions</p>
            {report.responseTrace.actions.map((action, idx) => (
              <div key={`${action.type}-${idx}`} className="rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{action.type}</span>
                {"url" in action && typeof action.url === "string" ? (
                  <span className="ml-2 break-all font-mono text-xs text-muted-foreground">{action.url}</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RawJsonCard({ json }: { json: string }): JSX.Element {
  return (
    <Card>
      <CardContent className="py-6">
        <details>
          <summary className="cursor-pointer text-sm font-medium">Raw report JSON</summary>
          <pre className="mt-4 max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
            <code>{json}</code>
          </pre>
        </details>
      </CardContent>
    </Card>
  );
}

function AppealCard({
  auditRecord,
  appealApiStatus,
  appealReason,
  onAppealReasonChange,
  onSubmit,
  appealSubmissionState,
  isAppealable,
  configured
}: {
  auditRecord: AuditRecord;
  appealApiStatus: string | null;
  appealReason: string;
  onAppealReasonChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  appealSubmissionState:
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "error"; error: string }
    | { status: "submitted" };
  isAppealable: boolean;
  configured: boolean;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit appeal</CardTitle>
      </CardHeader>
      <CardContent>
        {auditRecord.appealApproved ? (
          <p className="text-sm text-muted-foreground">This slashed audit has already been compensated after review.</p>
        ) : appealApiStatus === "rejected" ? (
          <p className="text-sm text-muted-foreground">This slashed audit appeal was rejected in review.</p>
        ) : auditRecord.appealRequested ? (
          <p className="text-sm text-muted-foreground">This slashed audit is already in appeal review.</p>
        ) : configured ? (
          <form className="flex flex-col gap-3" onSubmit={(event) => void onSubmit(event)}>
            <textarea
              value={appealReason}
              onChange={(event) => onAppealReasonChange(event.target.value)}
              rows={5}
              placeholder="Explain why this slash should be reviewed."
              className="glass-input min-h-32 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {appealSubmissionState.status === "error" ? (
              <p role="alert" className="text-sm text-danger-foreground">{appealSubmissionState.error}</p>
            ) : null}
            {appealSubmissionState.status === "submitted" ? (
              <p className="text-sm text-success-foreground">Appeal submitted. Review is now pending.</p>
            ) : null}
            <Button type="submit" disabled={appealSubmissionState.status === "submitting" || !isAppealable}>
              {appealSubmissionState.status === "submitting" ? "Submitting..." : "Submit appeal"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Appeal submission is unavailable because the frontend appeal endpoint is not configured.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function Meta({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-words text-sm text-foreground", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}
