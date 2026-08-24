/**
 * 本模块对账 agent 声明的 `web_request` 主机与沙箱实际观测到的请求主机，产出稳定排序的差集及 ACTION_MISMATCH 信号。
 * actions 是 agent 自述，requestedHosts 是网络观测，两者信任等级不同；URL 解析失败或非 web 动作不会被伪造成有效声明，观测主机会去空白、小写和去重。
 * 任一“观察到但未声明”或“声明但未观察”都会保留双向差异并标记原因码，调用方不能只检查其中一侧。
 * 该结果是声明一致性证据，不替代 egress allowlist、DNS/IP 执行控制，也不证明某次请求获得了用户授权。
 * 对账是纯函数且不修改输入数组；没有网络、写入或回滚行为。
 */
import type { AuditAction, AuditActionReconciliation } from "../types/manifest";
import type { NetworkActivity } from "../network/egressPolicy";

function normalizeHosts(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

function extractHostFromAction(action: AuditAction): string | undefined {
  if (action.type !== "web_request" || typeof action.url !== "string") {
    return undefined;
  }

  try {
    return new URL(action.url).hostname;
  } catch {
    return undefined;
  }
}

function normalizeDeclaredHosts(actions: AuditAction[]): string[] {
  return normalizeHosts(actions.map(extractHostFromAction).filter((host): host is string => Boolean(host)));
}

function normalizeObservedHosts(observedHosts: string[]): string[] {
  return normalizeHosts(observedHosts.map((host) => host.trim().toLowerCase()));
}

export function reconcileAuditResponse(
  actions: AuditAction[],
  activity: Pick<NetworkActivity, "requestedHosts">
): AuditActionReconciliation {
  const declaredHosts = normalizeDeclaredHosts(actions);
  const observedHosts = normalizeObservedHosts(activity.requestedHosts ?? []);

  const undeclaredObservedHosts = observedHosts.filter((host) => !declaredHosts.includes(host));
  const declaredUnobservedHosts = declaredHosts.filter((host) => !observedHosts.includes(host));

  const result: AuditActionReconciliation = {
    declaredHosts,
    observedHosts,
    undeclaredObservedHosts,
    declaredUnobservedHosts
  };

  if (undeclaredObservedHosts.length > 0 || declaredUnobservedHosts.length > 0) {
    return {
      ...result,
      reasonCode: "ACTION_MISMATCH"
    };
  }

  return result;
}
