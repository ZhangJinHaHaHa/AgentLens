import type { AgentCatalogEntry, AgentRuntimeSecurityKind } from "./catalog";
import { getRuntimeSecurity } from "./catalog";

export type PlatformAuditDimension =
  | "security"
  | "taskExecution"
  | "cognitive"
  | "environment"
  | "engineering"
  | "compliance";

export type PlatformAuditStatus =
  | "ownerActionRequired"
  | "lockedWithoutImage";

export interface PlatformAuditReadiness {
  status: PlatformAuditStatus;
  runtimeKind: AgentRuntimeSecurityKind;
  canRunSandboxAudit: boolean;
  llmProvider: "MiniMax";
}

export const PLATFORM_AUDIT_DIMENSIONS: readonly PlatformAuditDimension[] = [
  "security",
  "taskExecution",
  "cognitive",
  "environment",
  "engineering",
  "compliance"
];

export function getPlatformAuditReadiness(entry: AgentCatalogEntry): PlatformAuditReadiness {
  const runtime = getRuntimeSecurity(entry);
  const canRunSandboxAudit = runtime.kind === "platform_image";

  return {
    status: canRunSandboxAudit ? "ownerActionRequired" : "lockedWithoutImage",
    runtimeKind: runtime.kind,
    canRunSandboxAudit,
    llmProvider: "MiniMax"
  };
}
