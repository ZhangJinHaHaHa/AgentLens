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
