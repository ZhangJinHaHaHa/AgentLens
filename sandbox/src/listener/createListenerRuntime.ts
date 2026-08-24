import { isHexString } from "ethers";
import { createJsonRpcWriteClient } from "../chain/jsonRpcWriteClient";
import { createLocalAuditRunOptions } from "../cli/localAuditOptions";
import { loadAuditChainManifestSource, loadManifestSource } from "../manifest/loadManifest";
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

/**
 * 依赖注入面覆盖网络、容器、持久化和链上写操作这些副作用边界，便于测试使用确定性替身。
 * 未注入时才落到生产实现；调用方不能通过替身绕过 createListenerRuntime 对“是否启用写回”的能力裁剪。
 */
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
  // 报告目录派生自监听状态根，使游标、重试元数据与其对应本地产物可作为一个运维单元迁移/备份。
  return resolveListenerReportsDir(config.stateDir);
}

function parseOptionalInteger(value: string | undefined, variableName: string): number | undefined {
  // 环境变量是部署信任边界：空值表示未配置，除此之外只接受十进制非负整数，拒绝隐式截断和科学计数法。
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
  // 此处只验证编码与长度；密钥来源、权限和轮换由部署层负责，运行时不会记录或回显该值。
  if (!isHexString(value, 32)) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key");
  }

  return value;
}

function parseWritebackConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ListenerWritebackConfig {
  // 只有精确字符串 "true" 才开放链上变更能力，拼写错误或其他真值均保持只读，形成 fail-closed 默认值。
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
  // 任一存储变量出现即要求完整解析配置，避免部分凭据被静默忽略后产生“已上传”的错误预期。
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
  /**
   * 配置在创建任何客户端前一次性归一化：必需 RPC/合约地址缺失立即失败，危险的写能力默认关闭。
   * 报告远端存储只有在写回开启且出现相关变量时才装配；这保留历史只读监听部署无需云存储凭据的兼容性。
   */
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
  // 可选子系统以其主开关变量为存在性门禁，再由各自读取器校验剩余字段，避免在这里复制配置规则。
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
  // 默认请求 ID 由链上交易与 tokenId 派生，重放同一事件时保持稳定；manifestUrl 作为沙箱环境输入显式传递。
  return buildStandardAuditRequest({
    taskId: `audit-${event.transactionHash}-${event.tokenId}`,
    currentBlock: event.blockNumber,
    envVars: [`MANIFEST_URL=${event.manifestUrl}`],
    history: []
  });
}

async function writeProcessedSummary(processed: ProcessedAuditRequested): Promise<void> {
  // 结构化摘要先写 stdout，供无写回模式和故障排查统一观测；它不代表链上交易已提交或确认。
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
    // V1 参数顺序是公开链上兼容契约；所有字段显式列出，防止对象展开顺序或新增属性改变 calldata。
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
    // V2 仅在存在维度分数时使用独立 ABI，并固定六维元组次序；不得用 V1 Interface 猜测编码。
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

  // 未知方法绝不透传到签名客户端，避免扩展调用面时意外授权任意合约写操作。
  throw new Error(`Unsupported writeback method: ${(request as { method: string }).method}`);
}

function encodeSlashBondCalldata(
  request: Parameters<Parameters<typeof writeSlashBond>[1]["submitContractCall"]>[0]
): `0x${string}` {
  // 罚没/补偿继续使用 Registry 基础 ABI；方法名和参数顺序都在本边界封闭，提交器只接收已编码字节。
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
  /**
   * Runtime 负责把配置组装成一次监听所需的能力集合，本身不拥有持久化游标或磁盘重试队列；
   * 唯一可变状态是下方每实例创建的内存去重器。是否存在 writeClient 同时决定写回、罚没、补偿及
   * 重试提交能力是否暴露，从结构上隔离只读部署与链上变更路径。
   */
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
  // 将配置捕获为本 runtime 的不可替换引用，避免轮询过程中环境变量变化造成单次审计使用混合策略。
  const questionConfig = config.questionConfig;
  const dockerNetwork = config.dockerNetwork;
  const reportStorage = config.reportStorage;
  const cosStore = reportStorage
    // 本地模式与腾讯云模式实现相同 putObject 契约；凭据只进入所选适配器闭包，不写入任务状态。
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
  const ipfsClient = reportStorage?.ipfs
    ? (dependencies.createIpfsHttpClient ?? createIpfsHttpClient)({
        apiUrl: reportStorage.ipfs.apiUrl,
        authToken: reportStorage.ipfs.authToken,
        fetchImpl: config.fetchImpl
      })
    : undefined;
  const storeReport =
    // 远端报告发布要求对象存储与 IPFS 两端都已就绪；缺任一适配器时保持 skipped，而非产生半完整引用。
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
    // 即使内部调用路径误用此闭包，缺少写客户端仍会在签名前失败，保留第二道只读保护。
    if (!writeClient) {
      throw new Error("writeback is not enabled");
    }

    // 所有审计写回统一绑定配置的 Registry 地址；request 不能覆盖交易目标。
    return writeClient.submitTransaction({
      to: config.contractAddress,
      data: encodeWritebackCalldata(request)
    });
  };

  return {
    // 去重作用域与 runtime 生命周期一致；重启后的恢复与幂等由 CLI 游标、持久队列和链上对账共同承担。
    deduper: createInMemoryEventDeduper(),
    getLatestBlockNumber: () =>
      getLatestBlockNumber({
        rpcUrl: config.rpcUrl,
        fetchImpl: config.fetchImpl
      }),
    pollAuditRequestedLogs: ({ fromBlock, toBlock }) =>
      // 轮询器只获得固定 RPC/合约配置，区块窗口由拥有游标的 CLI 逐轮提供。
      pollAuditRequestedLogs({
        rpcUrl: config.rpcUrl,
        contractAddress: config.contractAddress,
        fromBlock,
        toBlock,
        fetchImpl: config.fetchImpl
    }),
    processAuditRequested: (event) =>
      // 处理流水线的外部副作用在此集中绑定；本地报告始终落入当前 stateDir 的 reports 子目录。
      processAuditRequested(event, {
        loadManifestSource: dependencies.loadManifestSource ?? loadAuditChainManifestSource,
        persistAuditReport: (options) =>
          (dependencies.persistAuditReport ?? persistAuditReport)({
            ...options,
            baseDir: getReportPersistenceBaseDir(config)
          }),
        storePersistedAuditReport: storeReport,
        buildAuditRequest: questionConfig
          // 配置了 LLM 提供方才切换为动态问题生成；否则维持历史标准审计请求格式。
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
          // 清单位置和可选 Docker 网络进入沙箱启动边界，资源清理由 runLocalSandboxAudit 自身负责。
          (dependencies.runLocalSandboxAudit ?? runLocalSandboxAudit)({
            ...(dependencies.createLocalAuditRunOptions ?? createLocalAuditRunOptions)(
              manifestLocation,
              dockerNetwork ? { networkName: dockerNetwork } : undefined
            ),
            request
          })
      }),
    readLatestAuditReport: (tokenId) =>
      // 读接口不复用写客户端的签名状态，保持查询路径无私钥依赖。
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
            // 非罚没决策可重复调用且无副作用；只有策略同时给出 outcome 与 reasonCode 才进入链上变更。
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

          // auditId 与金额取自写回后的 latest 档案快照；该路径不自行去重/对账，失败恢复由外层 slash 队列负责。
          await (dependencies.writeSlashBond ?? writeSlashBond)(
            {
              tokenId: processed.writeback.tokenId,
              auditId: auditCount,
              amount: slashAmount,
              reasonCode: decision.reasonCode
            },
            {
              submitContractCall: async (call) => {
                // 边界再次核对方法名，防止被注入的 writer 借罚没通道提交其他 Registry 方法。
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
          // 队列 JSON 将 uint256 tokenId 保存为十进制字符串；恢复时 BigInt 解析失败会保留任务供后续诊断。
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
      // 摘要输出先于可选链上提交；提交异常由 CLI 捕获并以 eventKey 入持久化重试队列，本层不循环重试。
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
