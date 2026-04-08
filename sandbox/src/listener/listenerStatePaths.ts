import { join } from "node:path";

type ListenerEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function resolveDefaultListenerStateDir(cwd: string = process.cwd()): string {
  return join(cwd, ".runtime", "listener");
}

export function resolveListenerStateDir(stateDir?: string): string {
  return stateDir ?? resolveDefaultListenerStateDir();
}

export function resolveListenerStateDirFromEnv(env: ListenerEnv): string {
  return resolveListenerStateDir(env.AUDIT_LISTENER_STATE_DIR);
}

export function resolveListenerReportsDir(stateDir?: string): string {
  return join(resolveListenerStateDir(stateDir), "reports");
}

export function resolveListenerEvidenceDir(stateDir?: string): string {
  return join(resolveListenerStateDir(stateDir), "evidence");
}

export function resolveListenerAttestationsDir(stateDir?: string): string {
  return join(resolveListenerStateDir(stateDir), "attestations");
}
