import fs from "node:fs";
import path from "node:path";

import { Interface } from "ethers";

/**
 * 这里只投影监听器实际读取的 ABI 字段，而不是把编译产物当成已经完成运行时校验的对象。
 * JSON 文件属于部署输入：语法错误、字段缺失以及 ABI 结构错误会分别在解析、显式名称检查或
 * ethers Interface 构造阶段暴露，调用方不应把这个 TypeScript 断言理解为信任边界已经关闭。
 */
interface ContractArtifactFunctionEntry {
  type: "function";
  name: string;
  inputs: Array<{ type: string }>;
}

interface ContractArtifactEntry {
  type: string;
  name?: string;
  inputs?: Array<{ type: string }>;
}

export interface AuditRegistryArtifact {
  contractName: string;
  sourceName: string;
  abi: ContractArtifactEntry[];
}

/**
 * 产物路径以当前模块目录为锚点，避免守护进程工作目录变化时加载到另一份同名文件。
 * 相应地，编译/发布布局必须继续保留 sandbox 与 contracts 的相对层级；这是打包兼容约束，
 * 找不到文件时应直接失败，而不是悄悄退回可能与链上地址不匹配的 ABI。
 */
function getArtifactPath(): string {
  return path.resolve(__dirname, "../../../../contracts/artifacts/AgentAuditRegistry.json");
}

function getV2ArtifactPath(): string {
  return path.resolve(__dirname, "../../../../contracts/artifacts/AgentAuditRegistryV2.json");
}

function getV3ArtifactPath(): string {
  return path.resolve(__dirname, "../../../../contracts/artifacts/AgentAuditRegistryV3.json");
}

export function getAuditRegistryArtifact(): AuditRegistryArtifact {
  const artifactPath = getArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as AuditRegistryArtifact;

  // 名称检查阻止 V1 调用路径误装载其他版本；读取和解析错误保留原始异常，交由启动边界决定是否重试。
  if (artifact.contractName !== "AgentAuditRegistry") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryV2Artifact(): AuditRegistryArtifact {
  const artifactPath = getV2ArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as AuditRegistryArtifact;

  // V2 不向 V1 回退，因为维度分数元组会改变 calldata；错误版本比启动失败更危险。
  if (artifact.contractName !== "AgentAuditRegistryV2") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryInterface(): Interface {
  // 每次从磁盘重建 Interface，使测试替身和部署产物保持单一事实来源；本模块不持有可变 ABI 缓存。
  return new Interface(getAuditRegistryArtifact().abi);
}

export function getAuditRegistryV2Interface(): Interface {
  return new Interface(getAuditRegistryV2Artifact().abi);
}

export function getAuditRegistryV3Artifact(): AuditRegistryArtifact {
  const artifactPath = getV3ArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as AuditRegistryArtifact;

  // V3 仍采用独立、严格的名称门禁，避免新增合约能力无意改变旧版本编码语义。
  if (artifact.contractName !== "AgentAuditRegistryV3") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryV3Interface(): Interface {
  return new Interface(getAuditRegistryV3Artifact().abi);
}

export function getRecordAuditResultEntry(): ContractArtifactFunctionEntry {
  // 当前兼容契约假定该名称没有重载；若 Solidity 侧引入重载，应改为按完整签名选择，不能依赖首个命中项。
  const entry = getAuditRegistryArtifact().abi.find(
    (candidate): candidate is ContractArtifactFunctionEntry =>
      candidate.type === "function" && candidate.name === "recordAuditResult"
  );

  if (!entry) {
    throw new Error("recordAuditResult ABI entry was not found in AgentAuditRegistry artifact");
  }

  return entry;
}

export function getRecordAuditResultV2Entry(): ContractArtifactFunctionEntry {
  // 此入口供编码契约和测试核对 V2 参数布局，缺失时立即失败可防止生成与链上实现不一致的交易数据。
  const entry = getAuditRegistryV2Artifact().abi.find(
    (candidate): candidate is ContractArtifactFunctionEntry =>
      candidate.type === "function" && candidate.name === "recordAuditResultV2"
  );

  if (!entry) {
    throw new Error(
      "recordAuditResultV2 ABI entry was not found in AgentAuditRegistryV2 artifact"
    );
  }

  return entry;
}

export function getSlashBondEntry(): ContractArtifactFunctionEntry {
  // slashBond 的名称与输入顺序属于链上公开兼容面；这里不做模糊匹配，也不吞掉产物漂移。
  const entry = getAuditRegistryArtifact().abi.find(
    (candidate): candidate is ContractArtifactFunctionEntry =>
      candidate.type === "function" && candidate.name === "slashBond"
  );

  if (!entry) {
    throw new Error("slashBond ABI entry was not found in AgentAuditRegistry artifact");
  }

  return entry;
}
