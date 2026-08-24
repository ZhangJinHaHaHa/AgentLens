/**
 * Edge 系列部署的配置归一化边界：把环境变量转换为 ethers 可消费的 RPC、链 ID、签名密钥、操作员地址及 wei 金额字符串。
 * `readRegistryDeploymentConfig` 只返回数据、不访问网络；必填整数限制为 JavaScript 安全整数，地址与 32 字节私钥交由 ethers 做语法校验，金额以 BigInt 规范化。
 * 环境变量是不可信输入：这里仅确认 RPC 非空而不验证协议或远端链身份，真正的链 ID 一致性及节点可信度由 provider/部署阶段承担。
 * 私钥保持原值返回但本模块不记录它；调用者不得把完整配置序列化到日志或部署元数据。空操作员地址表示由部署器回退到签名钱包。
 * 任一必填项缺失、格式非法、数值越过安全整数或 wei 不是十进制非负整数字符串时同步抛错，保证错误发生在签名和广播之前。
 * 输出字段 `serviceFeeWei`、`minimumBondWei` 是 V2/V3 构造参数约定；它们与旧 `deployEdge.js` 的 `initial*` 字段形状不同，不可直接混用。
 */
const { ethers } = require("ethers");

function parseRequiredInteger(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} is required`);
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${variableName} must be a non-negative integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${variableName} must be a safe integer`);
  }

  return parsed;
}

function parseRequiredPrivateKey(value, variableName) {
  if (!value) {
    throw new Error(`${variableName} is required`);
  }

  if (!ethers.isHexString(value, 32)) {
    throw new Error(`${variableName} must be a 32-byte hex private key`);
  }

  return value;
}

function parseOptionalAddress(value, variableName) {
  if (!value) {
    return "";
  }

  if (!ethers.isAddress(value)) {
    throw new Error(`${variableName} must be a valid EVM address`);
  }

  return value;
}

function parseWeiString(value, variableName, fallbackValue) {
  const rawValue = value || fallbackValue;

  if (!/^\d+$/u.test(rawValue)) {
    throw new Error(`${variableName} must be a non-negative integer string in wei`);
  }

  return BigInt(rawValue).toString();
}

function readRegistryDeploymentConfig(env, options = {}) {
  const rpcUrl = env.EDGE_RPC_URL;
  if (!rpcUrl) {
    throw new Error("EDGE_RPC_URL is required");
  }

  return {
    rpcUrl,
    chainId: parseRequiredInteger(env.EDGE_CHAIN_ID, "EDGE_CHAIN_ID"),
    deployerPrivateKey: parseRequiredPrivateKey(
      env.EDGE_DEPLOYER_PRIVATE_KEY,
      "EDGE_DEPLOYER_PRIVATE_KEY"
    ),
    networkName: env.EDGE_NETWORK_NAME || options.defaultNetworkName || "polygon-edge-test",
    initialOperator: parseOptionalAddress(env.EDGE_INITIAL_OPERATOR, "EDGE_INITIAL_OPERATOR"),
    serviceFeeWei: parseWeiString(
      env.EDGE_INITIAL_SERVICE_FEE_WEI,
      "EDGE_INITIAL_SERVICE_FEE_WEI",
      options.defaultServiceFeeWei || "0"
    ),
    minimumBondWei: parseWeiString(
      env.EDGE_INITIAL_MINIMUM_BOND_WEI,
      "EDGE_INITIAL_MINIMUM_BOND_WEI",
      options.defaultMinimumBondWei || "1"
    )
  };
}

module.exports = {
  parseOptionalAddress,
  parseRequiredInteger,
  parseRequiredPrivateKey,
  parseWeiString,
  readRegistryDeploymentConfig
};
