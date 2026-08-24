/**
 * 把目录条目的运行时安全类型映射为平台审计准备度，并固定展示六个审计维度及当前模型提供方标识。
 * 输入是一个 `AgentCatalogEntry`，输出为新的只读决策快照；函数不启动沙箱、不调用 MiniMax、不联网，也不维护状态或缓存。
 * 只有已识别为 `platform_image` 的条目具备沙箱审计能力，但状态仍要求所有者动作；该布尔值是前端流程提示，不是服务端执行授权。
 * 运行时元数据可能来自卖家或编辑声明，服务端必须重新核验镜像、所有权和隔离策略；缺少镜像时固定锁定，不做猜测、回退执行或自动重试。
 * 维度顺序和提供方字面量是报告/i18n 的兼容契约，协议升级需与审计服务同步而不能仅改展示层。
 */
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
