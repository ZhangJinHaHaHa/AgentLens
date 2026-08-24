import { Interface, isHexString, zeroPadValue } from "ethers";

import { createJsonRpcWriteClient, type CreateJsonRpcWriteClientOptions } from "../chain/jsonRpcWriteClient.js";

/**
 * 链写入配置属于部署侧信任边界：私钥只应由受控环境注入，并由下方写客户端在内存中持有。
 * 本模块不会记录私钥，但也不负责密钥轮换、权限校验或 RPC 端点的可信性验证。
 */
export interface AppealChainWriterConfig {
  rpcUrl: string;
  contractAddress: string;
  chainId: number;
  operatorPrivateKey: string;
}

export interface FileAppealOnChainRequest {
  // 这些字符串会在调用合约前转换成确定的 ABI 类型；调用方仍负责保证它们来自同一份申诉记录。
  tokenId: string;
  auditId: string;
  evidenceHash: string;
  appealCID: string;
}

export interface ResolveAppealOnChainRequest {
  tokenId: string;
  appealId: string;
  outcome: "approved" | "rejected";
}

export interface AppealChainWriteResult {
  // 默认客户端在取得成功回执后返回该哈希；单个回执不代表业务侧已经等待到链上最终性。
  transactionHash: `0x${string}`;
}

/**
 * 此接口刻意只表达“一次链写入”。实现不保存业务幂等键，也不在 RPC 超时后自动重发；
 * 调用方如需重试，应先按业务标识或交易哈希核对链上状态，避免把结果未知误判为未提交。
 */
export interface AppealChainWriter {
  fileAppealOnChain(request: FileAppealOnChainRequest): Promise<AppealChainWriteResult>;
  resolveAppealOnChain(request: ResolveAppealOnChainRequest): Promise<AppealChainWriteResult>;
}

export interface AppealChainWriterDependencies {
  createJsonRpcWriteClient?: (options: CreateJsonRpcWriteClientOptions) => ReturnType<typeof createJsonRpcWriteClient>;
}

// 下列片段同时固定了函数选择器和参数宽度，必须与 AUDIT_REGISTRY_V2_ADDRESS 指向的部署版本同步演进。
// V2 contract ABI fragments for appeal functions
const FILE_APPEAL_ABI = "function fileAppeal(uint256 tokenId, uint64 auditId, bytes32 evidenceHash, string appealCID)";
const RESOLVE_APPEAL_ABI = "function resolveAppeal(uint256 tokenId, uint64 appealId, uint8 outcome)";

function parseDecimalBigInt(value: string, field: string): bigint {
  // 先拒绝符号、指数和空串，避免 BigInt 接受的宽松文本形式改变公开十进制协议。
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }
  return BigInt(value.trim());
}

function parseDecimalNumber(value: string, field: string): number {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }
  const parsed = Number.parseInt(value.trim(), 10);
  // auditId/appealId 经 JavaScript number 传入 ABI；安全整数限制是当前适配层的兼容上限，窄于完整 uint64 域。
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${field} must be a safe integer.`);
  }
  return parsed;
}

function normalizeBytes32(value: string): string {
  // 兼容带或不带 0x 的短十六进制值，并统一左侧补零为 bytes32；这里只验证编码形状，不证明摘要来源可信。
  if (value.startsWith("0x")) {
    return zeroPadValue(value, 32);
  }
  return zeroPadValue(`0x${value}`, 32);
}

function outcomeToUint8(outcome: "approved" | "rejected"): number {
  // 数值映射是已部署合约枚举的持久化协议，不能仅按 TypeScript 联合类型的顺序调整。
  // AppealOutcome enum: 0 = Pending, 1 = Approved, 2 = Rejected
  return outcome === "approved" ? 1 : 2;
}

export function readAppealChainWriterConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AppealChainWriterConfig | undefined {
  // 功能采用显式 opt-in；关闭时不读取后续敏感配置，避免“配置了一半”意外启用签名路径。
  if (env.APPEAL_CHAIN_WRITER_ENABLED !== "true") {
    return undefined;
  }

  const rpcUrl = env.AUDIT_RPC_URL;
  const contractAddress = env.AUDIT_REGISTRY_V2_ADDRESS;
  const chainIdStr = env.AUDIT_CHAIN_ID;
  const operatorPrivateKey = env.AUDIT_OPERATOR_PRIVATE_KEY;

  if (!rpcUrl) throw new Error("AUDIT_RPC_URL is required when APPEAL_CHAIN_WRITER_ENABLED is true");
  if (!contractAddress) throw new Error("AUDIT_REGISTRY_V2_ADDRESS is required when APPEAL_CHAIN_WRITER_ENABLED is true");
  if (!chainIdStr) throw new Error("AUDIT_CHAIN_ID is required when APPEAL_CHAIN_WRITER_ENABLED is true");
  if (!operatorPrivateKey) throw new Error("AUDIT_OPERATOR_PRIVATE_KEY is required when APPEAL_CHAIN_WRITER_ENABLED is true");

  if (!isHexString(operatorPrivateKey, 32)) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key");
  }

  // 此边界只做必填项、裁剪和私钥长度检查；地址、chainId 与 RPC/合约匹配性由客户端及节点调用失败显式暴露。
  return {
    rpcUrl: rpcUrl.trim(),
    contractAddress: contractAddress.trim(),
    chainId: Number.parseInt(chainIdStr.trim(), 10),
    operatorPrivateKey: operatorPrivateKey.trim()
  };
}

export function createAppealChainWriter(
  config: AppealChainWriterConfig,
  dependencies: AppealChainWriterDependencies = {}
): AppealChainWriter {
  // 客户端在工厂阶段创建一次，使 nonce 查询、签名身份和 RPC 配置在该 writer 生命周期内保持同一所有者。
  const writeClient = (dependencies.createJsonRpcWriteClient ?? createJsonRpcWriteClient)({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    privateKey: config.operatorPrivateKey
  });

  const fileAppealInterface = new Interface([FILE_APPEAL_ABI]);
  const resolveAppealInterface = new Interface([RESOLVE_APPEAL_ABI]);

  // 两条路径均把编码/提交错误原样向上抛出；本层既不吞错，也不把未知提交结果转换成可安全重试的结果。
  return {
    async fileAppealOnChain(request: FileAppealOnChainRequest): Promise<AppealChainWriteResult> {
      const tokenId = parseDecimalBigInt(request.tokenId, "tokenId");
      const auditId = parseDecimalNumber(request.auditId, "auditId");
      const evidenceHash = normalizeBytes32(request.evidenceHash);

      // appealCID 由上层提供并作为任意字符串编码；ABI 编码不会验证它是否为可解析或可取回的内容地址。
      const data = fileAppealInterface.encodeFunctionData("fileAppeal", [
        tokenId,
        auditId,
        evidenceHash,
        request.appealCID
      ]);

      const receipt = await writeClient.submitTransaction({
        to: config.contractAddress,
        data: data as `0x${string}`
      });

      return { transactionHash: receipt.transactionHash };
    },

    async resolveAppealOnChain(request: ResolveAppealOnChainRequest): Promise<AppealChainWriteResult> {
      const tokenId = parseDecimalBigInt(request.tokenId, "tokenId");
      const appealId = parseDecimalNumber(request.appealId, "appealId");
      const outcome = outcomeToUint8(request.outcome);

      const data = resolveAppealInterface.encodeFunctionData("resolveAppeal", [
        tokenId,
        appealId,
        outcome
      ]);

      const receipt = await writeClient.submitTransaction({
        to: config.contractAddress,
        data: data as `0x${string}`
      });

      return { transactionHash: receipt.transactionHash };
    }
  };
}
