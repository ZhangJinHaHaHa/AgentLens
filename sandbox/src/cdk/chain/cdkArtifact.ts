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
