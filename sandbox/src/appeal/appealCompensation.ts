import { isHexString } from "ethers";

import { createJsonRpcWriteClient, type CreateJsonRpcWriteClientOptions } from "../chain/jsonRpcWriteClient";
import { getAuditRegistryInterface } from "../listener/auditRegistryArtifact";
import { writeCompensateBond, type WriteCompensateBondRequest } from "../listener/writeCompensateBond";

/**
 * 补偿执行器直接持有可签名配置，属于资金与权限边界。operatorPrivateKey 只应来自部署密钥系统，
 * contractAddress 则必须与下方加载的 AgentAuditRegistry ABI 版本一致。
 */
export interface AppealCompensationConfig {
  rpcUrl: string;
  contractAddress: string;
  chainId: number;
  operatorPrivateKey: string;
}

export interface AppealCompensationRequest {
  // tokenId、auditId 与 amount 使用十进制字符串跨越 HTTP/JSON 边界，避免 JSON number 丢失大整数精度。
  tokenId: string;
  auditId: string;
  amount: string;
  reasonCode: string;
}

export interface AppealCompensationResult {
  transactionHash: `0x${string}`;
}

export type AppealCompensationExecutor = (
  request: AppealCompensationRequest
) => Promise<AppealCompensationResult>;

/**
 * 注入点用于隔离真实签名/RPC 副作用；替代实现必须保持“成功结果含 transactionHash、失败则 reject”的契约，
 * 否则下方对未知 receipt 的防御检查会把它视为结果不完整。
 */
export interface CreateAppealCompensationDependencies {
  createJsonRpcWriteClient?: (
    options: CreateJsonRpcWriteClientOptions
  ) => ReturnType<typeof createJsonRpcWriteClient>;
  writeCompensateBond?: (
    request: WriteCompensateBondRequest,
    deps: Parameters<typeof writeCompensateBond>[1]
  ) => Promise<unknown>;
}

function parseRequiredInteger(value: string | undefined, variableName: string): number {
  // 环境变量协议只接受无符号十进制文本；具体 chainId 是否存在、是否与节点一致要到 RPC 边界确认。
  if (!value) {
    throw new Error(`${variableName} is required when AUDIT_APPEAL_COMPENSATION_ENABLED is true`);
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  return Number.parseInt(value, 10);
}

function parseRequiredString(value: string | undefined, variableName: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${variableName} is required when AUDIT_APPEAL_COMPENSATION_ENABLED is true`);
  }

  return value.trim();
}

function parseRequiredPrivateKey(value: string | undefined): string {
  // 这里只检查 32 字节十六进制形状，不验证该密钥是否有合约操作权限或是否应当轮换。
  const privateKey = parseRequiredString(value, "AUDIT_OPERATOR_PRIVATE_KEY");
  if (!isHexString(privateKey, 32)) {
    throw new Error("AUDIT_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key");
  }

  return privateKey;
}

export function readAppealCompensationConfigFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AppealCompensationConfig | undefined {
  // 精确字符串 "true" 才开启真实资产补偿，防止模糊真值让签名路径在错误环境中被意外激活。
  if (env.AUDIT_APPEAL_COMPENSATION_ENABLED !== "true") {
    return undefined;
  }

  return {
    rpcUrl: parseRequiredString(env.AUDIT_RPC_URL, "AUDIT_RPC_URL"),
    // 补偿调用使用旧版 AgentAuditRegistry ABI，因此这里有意读取非 V2 的地址变量；升级时两者必须成对迁移。
    contractAddress: parseRequiredString(env.AUDIT_REGISTRY_ADDRESS, "AUDIT_REGISTRY_ADDRESS"),
    chainId: parseRequiredInteger(env.AUDIT_CHAIN_ID, "AUDIT_CHAIN_ID"),
    operatorPrivateKey: parseRequiredPrivateKey(env.AUDIT_OPERATOR_PRIVATE_KEY)
  };
}

function parseDecimalBigInt(value: string, field: string): bigint {
  // 显式排除负号、小数和科学计数法，使金额与 tokenId 的文本表示在各调用方之间保持确定。
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }

  return BigInt(value.trim());
}

function parseDecimalInteger(value: string, field: string): number {
  if (!/^\d+$/u.test(value.trim())) {
    throw new Error(`${field} must be a non-empty decimal string.`);
  }

  const parsed = Number.parseInt(value.trim(), 10);
  // writeCompensateBond 当前以 number 承载 auditId；超过安全整数时主动失败，避免静默舍入后补偿错误审计记录。
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${field} must be a safe integer.`);
  }

  return parsed;
}

export function createAppealCompensationExecutor(
  config: AppealCompensationConfig,
  dependencies: CreateAppealCompensationDependencies = {}
): AppealCompensationExecutor {
  // 写客户端与私钥绑定在执行器闭包内，外层只拿到窄化后的补偿函数，不需要接触签名材料。
  const writeClient = (dependencies.createJsonRpcWriteClient ?? createJsonRpcWriteClient)({
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    privateKey: config.operatorPrivateKey
  });
  // 该接口来自 AgentAuditRegistry 构建产物；reasonCode 的 bytes32 兼容编码由 writeCompensateBond 统一完成。
  const auditRegistryInterface = getAuditRegistryInterface();

  return async (request: AppealCompensationRequest): Promise<AppealCompensationResult> => {
    // 所有可精确验证的数值先在副作用前完成规范化，格式错误不会触发签名或广播。
    const receipt = await (dependencies.writeCompensateBond ?? writeCompensateBond)(
      {
        tokenId: parseDecimalBigInt(request.tokenId, "tokenId"),
        auditId: parseDecimalInteger(request.auditId, "auditId"),
        amount: parseDecimalBigInt(request.amount, "amount"),
        reasonCode: request.reasonCode
      },
      {
        submitContractCall: async (call) =>
          writeClient.submitTransaction({
            to: config.contractAddress,
            data: auditRegistryInterface.encodeFunctionData(
              "compensateBond",
              [call.args.tokenId, call.args.auditId, call.args.amount, call.args.reasonCode]
            ) as `0x${string}`
          })
      }
    );

    // 到达这里可能已经发生不可回滚的链上副作用；缺少哈希时不能把异常等同于“交易未提交”。
    // 本执行器不持久化请求键或自动重试，恢复方应先按 tokenId/auditId 核对链上事件，再决定是否重放。
    const transactionHash = (receipt as { transactionHash?: `0x${string}` }).transactionHash;
    if (!transactionHash) {
      throw new Error("compensateBond submission did not return a transaction hash.");
    }

    return { transactionHash };
  };
}
