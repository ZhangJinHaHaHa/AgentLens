/**
 * 该适配器从仓库内构建产物加载 V2/V3 ABI，并为 CDK 读写路径提供惰性缓存的 ethers Interface；不负责编译合约或选择部署地址。
 * 文件系统中的 artifact 是构建时信任边界：JSON 可解析后仍须核对 contractName，错误版本必须立即拒绝，不能用相似 ABI 继续运行。
 * 成功输出为只读使用的 artifact 或进程内 Interface；副作用仅是同步读文件与首次访问时写入模块级缓存，不产生网络或链上操作。
 * Node 模块初始化在单线程事件循环中保证缓存发布不跨 await；路径和合约名称是兼容不变量，产物移动或重命名应显式更新这里。
 */
import fs from "node:fs";
import path from "node:path";

import { Interface } from "ethers";

interface ContractArtifactEntry {
  type: string;
  name?: string;
  inputs?: Array<{ type: string }>;
}

interface ContractArtifact {
  contractName: string;
  sourceName: string;
  abi: ContractArtifactEntry[];
}

function getV2ArtifactPath(): string {
  return path.resolve(__dirname, "../../../../../contracts/artifacts/AgentAuditRegistryV2.json");
}

function getV3ArtifactPath(): string {
  return path.resolve(__dirname, "../../../../../contracts/artifacts/AgentAuditRegistryV3.json");
}

export function getCdkV2Artifact(): ContractArtifact {
  const artifactPath = getV2ArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ContractArtifact;

  if (artifact.contractName !== "AgentAuditRegistryV2") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getCdkV3Artifact(): ContractArtifact {
  const artifactPath = getV3ArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as ContractArtifact;

  if (artifact.contractName !== "AgentAuditRegistryV3") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

let cachedInterface: Interface | undefined;

export function getCdkV2Interface(): Interface {
  if (cachedInterface === undefined) {
    cachedInterface = new Interface(getCdkV2Artifact().abi);
  }

  return cachedInterface;
}

let cachedV3Interface: Interface | undefined;

export function getCdkV3Interface(): Interface {
  if (cachedV3Interface === undefined) {
    cachedV3Interface = new Interface(getCdkV3Artifact().abi);
  }

  return cachedV3Interface;
}
