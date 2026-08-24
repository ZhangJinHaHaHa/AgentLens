import { join } from "node:path";

type ListenerEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

/**
 * 默认状态根目录绑定调用时的 process.cwd()，而不是源码或可执行文件位置。
 * 服务化部署若可能从不同工作目录启动，必须显式配置 AUDIT_LISTENER_STATE_DIR，
 * 否则游标、锁和重试队列会被分散到不同目录，表现为一次全新的监听器实例。
 */
export function resolveDefaultListenerStateDir(cwd: string = process.cwd()): string {
  return join(cwd, ".runtime", "listener");
}

export function resolveListenerStateDir(stateDir?: string): string {
  // 使用空值合并保持既有兼容语义：只有 undefined 才启用默认值，显式空字符串仍被视为调用方选择。
  return stateDir ?? resolveDefaultListenerStateDir();
}

export function resolveListenerStateDirFromEnv(env: ListenerEnv): string {
  return resolveListenerStateDir(env.AUDIT_LISTENER_STATE_DIR);
}

export function resolveListenerReportsDir(stateDir?: string): string {
  // 各类产物共享同一状态根，但分属固定子目录；文件名是 CLI 校验工具与运维脚本依赖的布局契约。
  return join(resolveListenerStateDir(stateDir), "reports");
}

export function resolveListenerEvidenceDir(stateDir?: string): string {
  // join 仅负责确定布局，不创建目录或检查权限；实际持久化边界负责建目录并传播 I/O 错误。
  return join(resolveListenerStateDir(stateDir), "evidence");
}

export function resolveListenerAttestationsDir(stateDir?: string): string {
  // 证明材料与报告/证据链物理隔离，便于分别校验和保留，同时仍跟随同一个 listener stateDir 迁移。
  return join(resolveListenerStateDir(stateDir), "attestations");
}
