import fs from "node:fs";
import path from "node:path";

import { utils } from "ethers";

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

  if (artifact.contractName !== "AgentAuditRegistry") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryV2Artifact(): AuditRegistryArtifact {
  const artifactPath = getV2ArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as AuditRegistryArtifact;

  if (artifact.contractName !== "AgentAuditRegistryV2") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryInterface(): utils.Interface {
  return new utils.Interface(getAuditRegistryArtifact().abi);
}

export function getAuditRegistryV2Interface(): utils.Interface {
  return new utils.Interface(getAuditRegistryV2Artifact().abi);
}

export function getAuditRegistryV3Artifact(): AuditRegistryArtifact {
  const artifactPath = getV3ArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as AuditRegistryArtifact;

  if (artifact.contractName !== "AgentAuditRegistryV3") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryV3Interface(): utils.Interface {
  return new utils.Interface(getAuditRegistryV3Artifact().abi);
}

export function getRecordAuditResultEntry(): ContractArtifactFunctionEntry {
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
  const entry = getAuditRegistryArtifact().abi.find(
    (candidate): candidate is ContractArtifactFunctionEntry =>
      candidate.type === "function" && candidate.name === "slashBond"
  );

  if (!entry) {
    throw new Error("slashBond ABI entry was not found in AgentAuditRegistry artifact");
  }

  return entry;
}
