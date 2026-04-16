import { utils } from "ethers";
import { createJsonRpcWriteClient } from "../chain/jsonRpcWriteClient";
import { createLocalAuditRunOptions } from "../cli/localAuditOptions";
import { loadManifestSource } from "../manifest/loadManifest";
import { runLocalSandboxAudit } from "../runtime/runLocalSandboxAudit";
import type { AuditSolveRequest, SandboxManifest } from "../types/manifest";
import {
  getAuditRegistryInterface,
  getAuditRegistryV2Interface
} from "./auditRegistryArtifact";
import { createInMemoryEventDeduper } from "./inMemoryEventDeduper";
import { getLatestBlockNumber, pollAuditRequestedLogs } from "./pollAuditRequestedLogs";
import { processAuditRequested } from "./processAuditRequested";
import { readLatestAuditReport } from "./readLatestAuditReport";
import type {
  PostWritebackSlashRequest,
  RunAuditRequestedListenerDependencies
} from "./runAuditRequestedListener";
import { evaluateSlashDecision } from "./slashPolicy";
import type {
  AuditRequestedEvent,
  ListenerWritebackConfig,
  ListenerRetryQueueItem,
  ProcessedAuditRequested
} from "./types";
import { writeAuditResult, writeAuditResultSummary } from "./writeAuditResult";
import type { WriteAuditResultDependencies } from "./writeAuditResult";
import { buildStandardAuditRequest } from "../audit/buildStandardAuditRequest";
import { buildLlmAuditRequest } from "../audit/buildLlmAuditRequest";
import { readAuditQuestionConfig } from "../audit/readAuditQuestionConfig";
import type { AuditQuestionConfig } from "../audit/auditQuestionTypes";
import { persistAuditReport } from "../report/persistAuditReport";
import { createIpfsHttpClient } from "../report/ipfsHttpClient";
import { readReportStorageConfig, type ReportStorageConfig } from "../report/readReportStorageConfig";
import { storePersistedAuditReport } from "../report/storePersistedAuditReport";
import { createTencentCosReportStore } from "../report/tencentCosReportStore";
import { createLocalDirectoryReportStore } from "../report/localDirectoryReportStore";
import { resolveListenerReportsDir, resolveListenerStateDirFromEnv } from "./listenerStatePaths";
import { readAgentProfile } from "./readAgentProfile";
import { readAuditReportByIndex } from "./readAuditReportByIndex";
import { writeCompensateBond } from "./writeCompensateBond";
import { writeSlashBond } from "./writeSlashBond";
import { readAttestationConfig, type AttestationConfig } from "../attestation/readAttestationConfig";
import {
  createHttpAttestationClient,
  type HttpAttestationClient
} from "../attestation/httpAttestationClient";

export interface ListenerRuntimeConfig {
  rpcUrl: string;
  contractAddress: string;
  startBlock?: number;
  stateDir?: string;
  pollIntervalMs: number;
  fetchImpl?: typeof fetch;
  writeback?: ListenerWritebackConfig;
  reportStorage?: ReportStorageConfig;
  dockerNetwork?: string;
  questionConfig?: AuditQuestionConfig;
  attestation?: AttestationConfig;
}

export interface CreateListenerRuntimeDependencies {
  createJsonRpcWriteClient?: typeof createJsonRpcWriteClient;
  createLocalAuditRunOptions?: typeof createLocalAuditRunOptions;
  loadManifestSource?: typeof loadManifestSource;
  persistAuditReport?: typeof persistAuditReport;
  runLocalSandboxAudit?: typeof runLocalSandboxAudit;
  createTencentCosReportStore?: typeof createTencentCosReportStore;
  createLocalDirectoryReportStore?: typeof createLocalDirectoryReportStore;
  createIpfsHttpClient?: typeof createIpfsHttpClient;
  storePersistedAuditReport?: typeof storePersistedAuditReport;
  readAgentProfile?: typeof readAgentProfile;
  readAuditReportByIndex?: typeof readAuditReportByIndex;
  writeSlashBond?: typeof writeSlashBond;
  writeCompensateBond?: typeof writeCompensateBond;
  createHttpAttestationClient?: typeof createHttpAttestationClient;
}

export interface ListenerRuntime extends RunAuditRequestedListenerDependencies {
  readLatestAuditReport: (tokenId: bigint) => Promise<Awaited<ReturnType<typeof readLatestAuditReport>>>;
  readAgentProfile: (tokenId: bigint) => Promise<Awaited<ReturnType<typeof readAgentProfile>>>;
  readAuditReportByIndex: (
    tokenId: bigint,
    index: number
  ) => Promise<Awaited<ReturnType<typeof readAuditReportByIndex>>>;
  submitSlashBond?: (request: Parameters<typeof writeSlashBond>[0]) => Promise<unknown>;
  submitCompensateBond?: (request: Parameters<typeof writeCompensateBond>[0]) => Promise<unknown>;
  submitRetryWriteback?: (item: ListenerRetryQueueItem) => Promise<unknown>;
}

function getReportPersistenceBaseDir(config: ListenerRuntimeConfig): string {
  return resolveListenerReportsDir(config.stateDir);
}

function parseOptionalInteger(value: string | undefined, variableName: string): number | undefined {
  if (!value) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  return parsed;
}

function parseOperatorPrivateKey(value: string): string {
  if (!utils.isHexString(value, 32)) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key");
  }

  return value;
}

function parseWritebackConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ListenerWritebackConfig {
  if (env.AUDIT_WRITEBACK_ENABLED !== "true") {
    return { enabled: false };
  }

  if (!env.AUDIT_OPERATOR_PRIVATE_KEY) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY is required when AUDIT_WRITEBACK_ENABLED is true");
  }

  if (!env.AUDIT_CHAIN_ID) {
    throw new Error("AUDIT_CHAIN_ID is required when AUDIT_WRITEBACK_ENABLED is true");
  }

  return {
    enabled: true,
    operatorPrivateKey: parseOperatorPrivateKey(env.AUDIT_OPERATOR_PRIVATE_KEY),
    chainId: parseOptionalInteger(env.AUDIT_CHAIN_ID, "AUDIT_CHAIN_ID") as number
  };
}

function hasAnyReportStorageEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return [
    env.AUDIT_REPORT_COS_SECRET_ID,
    env.AUDIT_REPORT_COS_SECRET_KEY,
    env.AUDIT_REPORT_COS_BUCKET,
    env.AUDIT_REPORT_COS_REGION,
    env.AUDIT_REPORT_COS_LOCAL_DIR,
    env.AUDIT_REPORT_COS_KEY_PREFIX,
    env.AUDIT_REPORT_IPFS_API_URL,
    env.AUDIT_REPORT_IPFS_AUTH_TOKEN
  ].some((value) => typeof value === "string" && value.length > 0);
}

export function readListenerRuntimeConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ListenerRuntimeConfig {
  const rpcUrl = env.AUDIT_RPC_URL;
  const contractAddress = env.AUDIT_REGISTRY_ADDRESS;

  if (!rpcUrl) {
    throw new Error("AUDIT_RPC_URL is required");
  }

  if (!contractAddress) {
    throw new Error("AUDIT_REGISTRY_ADDRESS is required");
  }

  const writeback = parseWritebackConfigFromEnv(env);
  const reportStorage =
    writeback.enabled && hasAnyReportStorageEnv(env) ? readReportStorageConfig(env) : undefined;

  const dockerNetwork = env.AUDIT_DOCKER_NETWORK || undefined;
  const questionConfig = env.AUDIT_LLM_PROVIDER
    ? readAuditQuestionConfig(env)
    : undefined;
  const attestation = env.AUDIT_ATTESTATION_API_URL
    ? readAttestationConfig(env)
    : undefined;

  return {
    rpcUrl,
    contractAddress,
    startBlock: parseOptionalInteger(env.AUDIT_LISTENER_START_BLOCK, "AUDIT_LISTENER_START_BLOCK"),
    stateDir: resolveListenerStateDirFromEnv(env),
    pollIntervalMs: parseOptionalInteger(
      env.AUDIT_LISTENER_POLL_INTERVAL_MS,
      "AUDIT_LISTENER_POLL_INTERVAL_MS"
    ) ?? 5000,
    writeback,
    ...(reportStorage ? { reportStorage } : {}),
    ...(dockerNetwork ? { dockerNetwork } : {}),
    ...(questionConfig ? { questionConfig } : {}),
    ...(attestation ? { attestation } : {})
  };
}

export function buildAuditRequestFromEvent(
  event: AuditRequestedEvent,
  _manifest?: SandboxManifest
): AuditSolveRequest {
  return buildStandardAuditRequest({
    taskId: `audit-${event.transactionHash}-${event.tokenId}`,
    currentBlock: event.blockNumber,
    envVars: [`MANIFEST_URL=${event.manifestUrl}`],
    history: []
  });
}

async function writeProcessedSummary(processed: ProcessedAuditRequested): Promise<void> {
  const reportStorage = processed.reportStorage;
  process.stdout.write(
    `${JSON.stringify(
      {
        type: "audit-processed",
        eventKey: processed.event.eventKey,
        tokenId: processed.writeback.tokenId.toString(),
        status: processed.writeback.status,
        auditScore: processed.writeback.auditScore,
        manifestHash: processed.writeback.manifestHash,
        reportHash: processed.writeback.reportHash,
        reportCID: processed.writeback.reportCID,
        manifestUrl: processed.writeback.manifestUrl,
        reportFilePath: processed.reportPersistence.reportFilePath,
        reportStorageOutcome: reportStorage?.outcome ?? "skipped",
        reportStorageCosObjectKey: reportStorage?.cosObjectKey ?? null,
        reportStorageError: reportStorage?.error ?? null,
        originalAuditStatus: reportStorage?.originalAuditStatus ?? null,
        originalAuditReasonCode: reportStorage?.originalAuditReasonCode ?? null
      },
      null,
      2
    )}\n`
  );
}

function encodeWritebackCalldata(
  request: Parameters<WriteAuditResultDependencies["submitContractCall"]>[0]
): `0x${string}` {
  if (request.method === "recordAuditResult") {
    return getAuditRegistryInterface().encodeFunctionData(request.method, [
      request.args.tokenId,
      request.args.auditScore,
      request.args.memoryPeakMb,
      request.args.cpuAvgMilli,
      request.args.requestIpCount,
      request.args.status,
      request.args.manifestHash,
      request.args.reportHash,
      request.args.evidenceRoot,
      request.args.attestationHash,
      request.args.evidenceCID,
      request.args.reportCID,
      request.args.manifestUrl
    ]) as `0x${string}`;
  }

  if (request.method === "recordAuditResultV2") {
    const scores = request.args.dimensionalScores;
    return getAuditRegistryV2Interface().encodeFunctionData(request.method, [
      request.args.tokenId,
      request.args.auditScore,
      request.args.memoryPeakMb,
      request.args.cpuAvgMilli,
      request.args.requestIpCount,
      request.args.status,
      request.args.manifestHash,
      request.args.reportHash,
      request.args.evidenceRoot,
      request.args.attestationHash,
      request.args.evidenceCID,
      request.args.reportCID,
      request.args.manifestUrl,
      [
        scores.security,
        scores.taskExecution,
        scores.cognitive,
        scores.environment,
        scores.engineering,
        scores.compliance
      ]
    ]) as `0x${string}`;
  }

  throw new Error(`Unsupported writeback method: ${(request as { method: string }).method}`);
}

function encodeSlashBondCalldata(
  request: Parameters<Parameters<typeof writeSlashBond>[1]["submitContractCall"]>[0]
): `0x${string}` {
  return getAuditRegistryInterface().encodeFunctionData("slashBond", [
    request.args.tokenId,
    request.args.auditId,
    request.args.amount,
    request.args.reasonCode
  ]) as `0x${string}`;
}

function encodeCompensateBondCalldata(
  request: Parameters<Parameters<typeof writeCompensateBond>[1]["submitContractCall"]>[0]
): `0x${string}` {
  return getAuditRegistryInterface().encodeFunctionData("compensateBond", [
    request.args.tokenId,
    request.args.auditId,
    request.args.amount,
    request.args.reasonCode
  ]) as `0x${string}`;
}

export function createListenerRuntime(
  config: ListenerRuntimeConfig,
  dependencies: CreateListenerRuntimeDependencies = {}
): ListenerRuntime {
  const writebackConfig = config.writeback ?? { enabled: false };
  const writeClient =
    writebackConfig.enabled
      ? (dependencies.createJsonRpcWriteClient ?? createJsonRpcWriteClient)({
          rpcUrl: config.rpcUrl,
          chainId: writebackConfig.chainId,
          privateKey: writebackConfig.operatorPrivateKey,
          pollIntervalMs: config.pollIntervalMs,
          fetchImpl: config.fetchImpl
        })
      : undefined;
  const attestationClient: HttpAttestationClient | undefined = config.attestation
    ? (dependencies.createHttpAttestationClient ?? createHttpAttestationClient)({
        ...config.attestation,
        fetchImpl: config.fetchImpl
      })
    : undefined;
  const questionConfig = config.questionConfig;
  const dockerNetwork = config.dockerNetwork;
  const reportStorage = config.reportStorage;
  const cosStore = reportStorage
    ? reportStorage.cos.mode === "local"
      ? (dependencies.createLocalDirectoryReportStore ?? createLocalDirectoryReportStore)({
          baseDir: reportStorage.cos.localDir
        })
      : (dependencies.createTencentCosReportStore ?? createTencentCosReportStore)({
          secretId: reportStorage.cos.secretId,
          secretKey: reportStorage.cos.secretKey,
          bucket: reportStorage.cos.bucket,
          region: reportStorage.cos.region
        })
    : undefined;
  const ipfsClient = reportStorage
    ? (dependencies.createIpfsHttpClient ?? createIpfsHttpClient)({
        apiUrl: reportStorage.ipfs.apiUrl,
        authToken: reportStorage.ipfs.authToken,
        fetchImpl: config.fetchImpl
      })
    : undefined;
  const storeReport =
    reportStorage && cosStore && ipfsClient
      ? (options: Parameters<typeof storePersistedAuditReport>[0]) =>
          (dependencies.storePersistedAuditReport ?? storePersistedAuditReport)(
            {
              ...options,
              cosKeyPrefix: reportStorage.cos.keyPrefix
            },
            {
              putObject: cosStore.putObject,
              addToIpfs: ipfsClient.addToIpfs
            }
          )
      : undefined;
  const submitContractCall: WriteAuditResultDependencies["submitContractCall"] = async (request) => {
    if (!writeClient) {
      throw new Error("writeback is not enabled");
    }

    return writeClient.submitTransaction({
      to: config.contractAddress,
      data: encodeWritebackCalldata(request)
    });
  };

  return {
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: () =>
      getLatestBlockNumber({
        rpcUrl: config.rpcUrl,
        fetchImpl: config.fetchImpl
      }),
    pollAuditRequestedLogs: ({ fromBlock, toBlock }) =>
      pollAuditRequestedLogs({
        rpcUrl: config.rpcUrl,
        contractAddress: config.contractAddress,
        fromBlock,
        toBlock,
        fetchImpl: config.fetchImpl
      }),
    processAuditRequested: (event) =>
      processAuditRequested(event, {
        loadManifestSource: dependencies.loadManifestSource ?? loadManifestSource,
        persistAuditReport: (options) =>
          (dependencies.persistAuditReport ?? persistAuditReport)({
            ...options,
            baseDir: getReportPersistenceBaseDir(config)
          }),
        storePersistedAuditReport: storeReport,
        buildAuditRequest: questionConfig
          ? (ev, manifest) =>
              buildLlmAuditRequest({
                taskId: `audit-${ev.transactionHash}-${ev.tokenId}`,
                manifest,
                config: questionConfig,
                currentBlock: ev.blockNumber,
                envVars: [`MANIFEST_URL=${ev.manifestUrl}`],
                fetchImpl: config.fetchImpl
              })
          : buildAuditRequestFromEvent,
        createAuditAttestation: attestationClient
          ? (input) => attestationClient.createAuditAttestation(input)
          : undefined,
        runAudit: async ({ manifestLocation, request }) =>
          (dependencies.runLocalSandboxAudit ?? runLocalSandboxAudit)({
            ...(dependencies.createLocalAuditRunOptions ?? createLocalAuditRunOptions)(
              manifestLocation,
              dockerNetwork ? { networkName: dockerNetwork } : undefined
            ),
            request
          })
      }),
    readLatestAuditReport: (tokenId) =>
      readLatestAuditReport({
        rpcUrl: config.rpcUrl,
        contractAddress: config.contractAddress,
        tokenId,
        fetchImpl: config.fetchImpl
      }),
    readAgentProfile: (tokenId) =>
      (dependencies.readAgentProfile ?? readAgentProfile)({
        rpcUrl: config.rpcUrl,
        contractAddress: config.contractAddress,
        tokenId,
        fetchImpl: config.fetchImpl
      }),
    readAuditReportByIndex: (tokenId, index) =>
      (dependencies.readAuditReportByIndex ?? readAuditReportByIndex)({
        rpcUrl: config.rpcUrl,
        contractAddress: config.contractAddress,
        tokenId,
        index,
        fetchImpl: config.fetchImpl
      }),
    evaluateSlashDecision: writeClient ? evaluateSlashDecision : undefined,
    handlePostWritebackSlash: writeClient
      ? async (request: PostWritebackSlashRequest) => {
          const { processed, decision } = request;
          if (decision.outcome !== "slash" || !decision.reasonCode) {
            return;
          }

          const profile = await (dependencies.readAgentProfile ?? readAgentProfile)({
            rpcUrl: config.rpcUrl,
            contractAddress: config.contractAddress,
            tokenId: processed.writeback.tokenId,
            fetchImpl: config.fetchImpl
          });

          const auditCount = profile.auditCount;
          const slashAmount = profile.totalBond;

          await (dependencies.writeSlashBond ?? writeSlashBond)(
            {
              tokenId: processed.writeback.tokenId,
              auditId: auditCount,
              amount: slashAmount,
              reasonCode: decision.reasonCode
            },
            {
              submitContractCall: async (call) => {
                if (call.method !== "slashBond") {
                  throw new Error(`Unsupported slash method: ${call.method}`);
                }

                return writeClient.submitTransaction({
                  to: config.contractAddress,
                  data: encodeSlashBondCalldata(call)
                });
              }
            }
          );
        }
      : undefined,
    submitSlashBond: writeClient
      ? (request) =>
          (dependencies.writeSlashBond ?? writeSlashBond)(request, {
            submitContractCall: async (call) => {
              if (call.method !== "slashBond") {
                throw new Error(`Unsupported slash method: ${call.method}`);
              }

              return writeClient.submitTransaction({
                to: config.contractAddress,
                data: encodeSlashBondCalldata(call)
              });
            }
          })
      : undefined,
    submitCompensateBond: writeClient
      ? (request) =>
          (dependencies.writeCompensateBond ?? writeCompensateBond)(request, {
            submitContractCall: async (call) => {
              if (call.method !== "compensateBond") {
                throw new Error(`Unsupported compensate method: ${call.method}`);
              }

              return writeClient.submitTransaction({
                to: config.contractAddress,
                data: encodeCompensateBondCalldata(call)
              });
            }
          })
      : undefined,
    submitRetryWriteback: writeClient
      ? (item) =>
          writeAuditResultSummary(
            {
              tokenId: BigInt(item.tokenId),
              ...item.writeback
            },
            {
              submitContractCall
            }
          )
      : undefined,
    writeAuditResult: async (processed) => {
      await writeProcessedSummary(processed);

      if (!writeClient) {
        return undefined;
      }

      return writeAuditResult(processed, {
        submitContractCall
      });
    }
  };
}
