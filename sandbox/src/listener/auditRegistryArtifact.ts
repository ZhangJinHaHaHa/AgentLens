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

export function getAuditRegistryArtifact(): AuditRegistryArtifact {
  const artifactPath = getArtifactPath();
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as AuditRegistryArtifact;

  if (artifact.contractName !== "AgentAuditRegistry") {
    throw new Error(`Unexpected contract artifact: ${artifact.contractName}`);
  }

  return artifact;
}

export function getAuditRegistryInterface(): utils.Interface {
  return new utils.Interface(getAuditRegistryArtifact().abi);
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
