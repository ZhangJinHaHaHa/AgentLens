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
