/**
 * 出口验收运行器在短生命周期容器中同时验证健康、期望规则、一个声明目标可达及一个未声明目标受阻，并用合取条件产生 accepted；不覆盖全部目的地或长期 DNS 变化。
 * manifest、镜像、daemon、两个 URL 和容器网络均跨越信任边界；accepted 只有在两次探针工具都可用且正反路径均符合预期时才可为 true。
 * manifest/daemon 预检可返回结构化失败，拉取、启动及运行期未分类异常按 Promise 传播；容器成功创建后 finally 必须 stop/remove，不因验收失败遗留资源。
 * 各阶段串行作用于同一容器以保留策略上下文，函数本身不支持并发共享容器；结果是一次时点证据，不能当作后续运行的持续网络保证。
 */
import {
  pullImage as defaultPullImage,
  removeContainer as defaultRemoveContainer,
  startContainer as defaultStartContainer,
  stopContainer as defaultStopContainer,
  type StartedContainer
} from "../docker/dockerRunner";
import { waitForHealth as defaultWaitForHealth } from "../docker/healthcheck";
import { checkDockerAvailability, type DockerAvailabilityResult } from "../docker/checkDockerAvailability";
import type { HealthcheckOptions } from "../docker/healthcheck";
import { ManifestValidationError, loadManifestSource } from "../manifest/loadManifest";
import {
  probeEgress as defaultProbeEgress,
  type EgressProbeResult
} from "../network/egressProbe";
import {
  verifyFirewallRules as defaultVerifyFirewallRules,
  type FirewallVerificationResult
} from "../network/firewallVerify";
import type { SandboxManifest } from "../types/manifest";

export interface EgressAcceptanceResult {
  manifestValid: boolean;
  dockerAvailable: boolean;
  serverVersion?: string;
  healthcheckPassed?: boolean;
  firewallConfigured?: boolean;
  allowedEgressTargetUrl?: string;
  allowedEgressReachable?: boolean;
  allowedEgressProbeAvailable?: boolean;
  blockedEgressTargetUrl?: string;
  undeclaredEgressBlocked?: boolean;
  blockedEgressProbeAvailable?: boolean;
  accepted: boolean;
  reasonCode?: string;
}

export interface RunEgressAcceptanceCheckOptions {
  manifestPath: string;
  allowedEgressTargetUrl: string;
  blockedEgressTargetUrl: string;
  checkDockerAvailability?: () => Promise<DockerAvailabilityResult>;
  pullImage?: (manifest: SandboxManifest) => Promise<void>;
  startContainer?: (manifest: SandboxManifest) => Promise<StartedContainer>;
  waitForHealth?: (options: HealthcheckOptions) => Promise<void>;
  verifyFirewallRules?: (
    containerId: string,
    manifest: SandboxManifest
  ) => Promise<FirewallVerificationResult>;
  probeEgress?: (containerId: string, targetUrl: string) => Promise<EgressProbeResult>;
  stopContainer?: (containerId: string) => Promise<void>;
  removeContainer?: (containerId: string) => Promise<void>;
}

export async function runEgressAcceptanceCheck(
  options: RunEgressAcceptanceCheckOptions
): Promise<EgressAcceptanceResult> {
  let manifest: SandboxManifest;

  try {
    manifest = (await loadManifestSource(options.manifestPath)).manifest;
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      return {
        manifestValid: false,
        dockerAvailable: false,
        accepted: false,
        reasonCode: error.reasonCode
      };
    }

    throw error;
  }

  const dockerAvailability = await (options.checkDockerAvailability ?? checkDockerAvailability)();

  if (!dockerAvailability.available) {
    return {
      manifestValid: true,
      dockerAvailable: false,
      accepted: false,
      reasonCode: dockerAvailability.reason
    };
  }

  await (options.pullImage ?? defaultPullImage)(manifest);
  const startedContainer = await (options.startContainer ?? defaultStartContainer)(manifest);

  try {
    await (options.waitForHealth ?? defaultWaitForHealth)({
      host: startedContainer.host,
      port: startedContainer.port
    });

    const firewallVerification = await (options.verifyFirewallRules ?? defaultVerifyFirewallRules)(
      startedContainer.containerId,
      manifest
    );
    const allowedProbe = await (options.probeEgress ?? defaultProbeEgress)(
      startedContainer.containerId,
      options.allowedEgressTargetUrl
    );
    const blockedProbe = await (options.probeEgress ?? defaultProbeEgress)(
      startedContainer.containerId,
      options.blockedEgressTargetUrl
    );

    return {
      manifestValid: true,
      dockerAvailable: true,
      serverVersion: dockerAvailability.serverVersion,
      healthcheckPassed: true,
      firewallConfigured: firewallVerification.configured,
      allowedEgressTargetUrl: options.allowedEgressTargetUrl,
      allowedEgressReachable: allowedProbe.reachable,
      allowedEgressProbeAvailable: allowedProbe.toolAvailable,
      blockedEgressTargetUrl: options.blockedEgressTargetUrl,
      undeclaredEgressBlocked: !blockedProbe.reachable,
      blockedEgressProbeAvailable: blockedProbe.toolAvailable,
      accepted:
        firewallVerification.configured &&
        allowedProbe.toolAvailable &&
        allowedProbe.reachable &&
        blockedProbe.toolAvailable &&
        !blockedProbe.reachable
    };
  } finally {
    await (options.stopContainer ?? defaultStopContainer)(startedContainer.containerId);
    await (options.removeContainer ?? defaultRemoveContainer)(startedContainer.containerId);
  }
}
