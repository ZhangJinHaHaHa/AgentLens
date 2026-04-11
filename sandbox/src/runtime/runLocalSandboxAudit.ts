import { DEFAULT_CPU, DEFAULT_MEMORY_MB, DEFAULT_TIMEOUT_MS } from "../config/constants";
import type { StartedContainer } from "../docker/dockerRunner";
import type { HealthcheckOptions } from "../docker/healthcheck";
import { classifyAuditDecision } from "../audit/classifyAuditDecision";
import { reconcileAuditResponse } from "../audit/reconcileAuditResponse";
import { loadManifestSource } from "../manifest/loadManifest";
import { buildEgressPolicy, evaluateNetworkActivity } from "../network/egressPolicy";
import type {
  AuditSolveRequest,
  AuditSolveResponse,
  LocalAuditResult,
  AnswerEvaluationMeta,
  SecurityBoundaryMeta,
  NetworkEvidence,
  SandboxManifest
} from "../types/manifest";
import type { AuditEvidenceStage } from "../evidence/buildAuditEvidenceEvent";
import type { LlmClientConfig } from "../audit/evaluateAuditAnswer";
import { evaluateAuditAnswers } from "../audit/evaluateAuditAnswer";
import { computeSecurityBoundaryScore } from "../audit/securityBoundaryScore";

export interface ResourceUsage {
  cpuAvgMilli: number;
  memoryPeakMb: number;
}

export interface NetworkActivity {
  requestedIps: string[];
  requestedHosts: string[];
  requestCount: number;
  networkEvidence?: NetworkEvidence;
}

export interface RunLocalSandboxAuditOptions {
  manifestPath: string;
  request: AuditSolveRequest;
  pullImage: (manifest: SandboxManifest) => Promise<void>;
  startContainer: (manifest: SandboxManifest) => Promise<StartedContainer>;
  waitForHealth: (options: HealthcheckOptions) => Promise<void>;
  sendAuditRequest: (options: {
    host: string;
    port: number;
    request: AuditSolveRequest;
    timeoutMs: number;
  }) => Promise<AuditSolveResponse>;
  collectResourceUsage: (containerId: string) => Promise<ResourceUsage>;
  collectNetworkActivity: (containerId: string) => Promise<NetworkActivity>;
  emitEvidence?: (event: {
    stage: AuditEvidenceStage;
    payload: unknown;
    timestamp?: string;
  }) => Promise<void>;
  killContainer: (containerId: string) => Promise<void>;
  stopContainer: (containerId: string) => Promise<void>;
  removeContainer: (containerId: string) => Promise<void>;
  /** LLM config for answer evaluation. If unset, evaluation is skipped. */
  evaluationLlmConfig?: LlmClientConfig;
}

function getResourceFailureReason(resources: ResourceUsage): string | undefined {
  if (resources.memoryPeakMb > DEFAULT_MEMORY_MB) {
    return "MEMORY_LIMIT_EXCEEDED";
  }

  if (resources.cpuAvgMilli > DEFAULT_CPU * 1000) {
    return "CPU_LIMIT_EXCEEDED";
  }

  return undefined;
}

function getInfrastructureFailureReason(error: unknown, fallbackReason: string): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Cannot connect to the Docker daemon")) {
    return "DOCKER_UNAVAILABLE";
  }

  return fallbackReason;
}

function buildFailedResult(options: {
  manifest: SandboxManifest;
  manifestHash: string;
  startedAt: string;
  healthcheckPassed: boolean;
  reasonCode: string;
}): LocalAuditResult {
  const decision = classifyAuditDecision({
    status: "failed",
    reasonCode: options.reasonCode,
    answer: "",
    actions: []
  });

  return {
    agentName: options.manifest.agent_name,
    manifestHash: options.manifestHash,
    healthcheckPassed: options.healthcheckPassed,
    answer: "",
    actions: [],
    decisionType: decision.decisionType,
    cpuAvgMilli: 0,
    memoryPeakMb: 0,
    requestedIps: [],
    requestedHosts: [],
    requestCount: 0,
    status: "failed",
    reasonCode: options.reasonCode,
    startedAt: options.startedAt,
    finishedAt: new Date().toISOString()
  };
}

export async function runLocalSandboxAudit(
  options: RunLocalSandboxAuditOptions
): Promise<LocalAuditResult> {
  const { manifest, manifestHash } = await loadManifestSource(options.manifestPath);
  const startedAt = new Date().toISOString();

  try {
    await options.pullImage(manifest);
  } catch (error) {
    return buildFailedResult({
      manifest,
      manifestHash,
      startedAt,
      healthcheckPassed: false,
      reasonCode: getInfrastructureFailureReason(error, "IMAGE_PULL_FAILED")
    });
  }

  let startedContainer: StartedContainer;

    try {
      startedContainer = await options.startContainer(manifest);
      await options.emitEvidence?.({
        stage: "container_started",
        payload: {
          image: manifest.image,
          host: startedContainer.host,
          port: startedContainer.port
        }
      });
  } catch (error) {
    return buildFailedResult({
      manifest,
      manifestHash,
      startedAt,
      healthcheckPassed: false,
      reasonCode: getInfrastructureFailureReason(error, "CONTAINER_START_FAILED")
    });
  }

  try {
    try {
      await options.waitForHealth({
        host: startedContainer.host,
        port: startedContainer.port
      });
      await options.emitEvidence?.({
        stage: "healthcheck_passed",
        payload: {
          host: startedContainer.host,
          port: startedContainer.port
        }
      });
    } catch (error) {
      const reasonCode =
        error instanceof Error && "reasonCode" in error && typeof error.reasonCode === "string"
          ? error.reasonCode
          : "AGENT_UNAVAILABLE";

      return buildFailedResult({
        manifest,
        manifestHash,
        startedAt,
        healthcheckPassed: false,
        reasonCode
      });
    }

    let response: AuditSolveResponse;

    try {
      await options.emitEvidence?.({
        stage: "audit_request_sent",
        payload: {
          taskId: options.request.task_id
        }
      });
      response = await options.sendAuditRequest({
        host: startedContainer.host,
        port: startedContainer.port,
        request: options.request,
        timeoutMs: DEFAULT_TIMEOUT_MS
      });
      await options.emitEvidence?.({
        stage: "audit_response_received",
        payload: {
          answerLength: response.answer.length,
          actionCount: response.actions.length
        }
      });
    } catch (error) {
      const reasonCode =
        error instanceof Error && "reasonCode" in error && typeof error.reasonCode === "string"
          ? error.reasonCode
          : undefined;

      if (!reasonCode) {
        throw error;
      }

      await options.killContainer(startedContainer.containerId);

      return buildFailedResult({
        manifest,
        manifestHash,
        startedAt,
        healthcheckPassed: true,
        reasonCode
      });
    }

    const [resources, network] = await Promise.all([
      options.collectResourceUsage(startedContainer.containerId),
      options.collectNetworkActivity(startedContainer.containerId)
    ]);
    await options.emitEvidence?.({
      stage: "resource_usage_collected",
      payload: resources
    });
    await options.emitEvidence?.({
      stage: "network_activity_collected",
      payload: {
        requestedIps: network.requestedIps,
        requestedHosts: network.requestedHosts,
        requestCount: network.requestCount,
        networkEvidence: network.networkEvidence
      }
    });

    const finishedAt = new Date().toISOString();
    const resourceFailureReason = getResourceFailureReason(resources);
    const networkFailureReason = evaluateNetworkActivity(network, buildEgressPolicy(manifest)).reasonCode;
    const reconciliation = reconcileAuditResponse(response.actions, network);
    const hasObservedHosts = reconciliation.observedHosts.length > 0;
    const actionFailureReason =
      reconciliation.undeclaredObservedHosts.length > 0 ||
      (hasObservedHosts && reconciliation.declaredUnobservedHosts.length > 0)
        ? "ACTION_MISMATCH"
        : undefined;
    const { reasonCode: _ignoredReasonCode, ...reconciliationWithoutReason } = reconciliation;
    const actionReconciliation =
      !hasObservedHosts && reconciliation.reasonCode === "ACTION_MISMATCH"
        ? reconciliationWithoutReason
        : reconciliation;
    const reasonCode = networkFailureReason ?? actionFailureReason ?? resourceFailureReason;
    const status = reasonCode ? "failed" : "completed";
    const decision = classifyAuditDecision({
      status,
      reasonCode,
      answer: response.answer,
      actions: response.actions
    });

    if (reasonCode) {
      await options.killContainer(startedContainer.containerId);
    }

    // LLM answer evaluation (optional)
    let answerEvaluations: AnswerEvaluationMeta[] | undefined;
    let securityBoundaryScore: SecurityBoundaryMeta | undefined;

    const questions = options.request.questions;
    const evalEnabled = process.env.AUDIT_EVALUATION_ENABLED !== "false";

    if (evalEnabled && questions && questions.length > 0 && options.evaluationLlmConfig) {
      try {
        const evals = await evaluateAuditAnswers(
          questions,
          response.answer,
          response.actions,
          options.evaluationLlmConfig
        );
        answerEvaluations = evals;
        securityBoundaryScore = computeSecurityBoundaryScore(evals);

        await options.emitEvidence?.({
          stage: "answer_evaluation_completed" as AuditEvidenceStage,
          payload: {
            evaluationCount: evals.length,
            securityBoundaryScore: securityBoundaryScore.score
          }
        });
      } catch (error) {
        // Evaluation failure is non-fatal — log but continue
        const msg = error instanceof Error ? error.message : String(error);
        await options.emitEvidence?.({
          stage: "answer_evaluation_completed" as AuditEvidenceStage,
          payload: { error: msg }
        });
      }
    }

    return {
      agentName: manifest.agent_name,
      manifestHash,
      healthcheckPassed: true,
      answer: response.answer,
      actions: response.actions,
      decisionType: decision.decisionType,
      actionReconciliation,
      cpuAvgMilli: resources.cpuAvgMilli,
      memoryPeakMb: resources.memoryPeakMb,
      requestedIps: network.requestedIps,
      requestedHosts: network.requestedHosts,
      requestCount: network.requestCount,
      ...(network.networkEvidence ? { networkEvidence: network.networkEvidence } : {}),
      status,
      reasonCode,
      startedAt,
      finishedAt,
      ...(questions ? { questions } : {}),
      ...(answerEvaluations ? { answerEvaluations } : {}),
      ...(securityBoundaryScore ? { securityBoundaryScore } : {})
    };
  } finally {
    await options.stopContainer(startedContainer.containerId);
    await options.removeContainer(startedContainer.containerId);
  }
}
