/**
 * 该工厂把本地审计编排器所需的 Docker、健康检查、请求发送与监控函数装配成一组依赖；不在构造时拉镜像、启动容器或执行审计。
 * 输入是 manifest 路径与可选 Docker 网络名，输出为可延迟执行的 RunLocalSandboxAuditOptions；网络名仅通过 startContainer 闭包影响运行拓扑。
 * 真正的文件、进程和网络副作用发生在下游调用这些函数时，manifest 仍须由运行时加载和验证，本层不会因类型存在而信任其内容。
 * 每次调用创建独立选项对象且不共享状态；标准任务 ID、空历史及依赖映射是本地 CLI 与运行器之间的兼容接缝。
 */
import { buildStandardAuditRequest } from "../audit/buildStandardAuditRequest";
import { sendAuditRequest } from "../audit/sendAuditRequest";
import {
  killContainer,
  pullImage,
  removeContainer,
  startContainer,
  stopContainer
} from "../docker/dockerRunner";
import { waitForHealth } from "../docker/healthcheck";
import { collectNetworkActivity } from "../monitor/networkMonitor";
import { collectResourceUsage } from "../monitor/resourceMonitor";
import type { RunLocalSandboxAuditOptions } from "../runtime/runLocalSandboxAudit";

export interface LocalAuditOverrides {
  networkName?: string;
}

export function createLocalAuditRunOptions(
  manifestPath: string,
  overrides?: LocalAuditOverrides
): RunLocalSandboxAuditOptions {
  const networkName = overrides?.networkName;

  return {
    manifestPath,
    request: buildStandardAuditRequest({
      taskId: "local-audit-task",
      history: []
    }),
    pullImage,
    startContainer: networkName
      ? (manifest) => startContainer(manifest, { networkName })
      : startContainer,
    waitForHealth,
    sendAuditRequest,
    collectResourceUsage,
    collectNetworkActivity,
    killContainer,
    stopContainer,
    removeContainer
  };
}
