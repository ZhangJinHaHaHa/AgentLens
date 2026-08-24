/**
 * Docker 烟测按 manifest 校验、daemon 探测、拉镜像、启动、探活、防火墙核对及可选阻断探针组织一次预检，并返回逐阶段事实；不执行正式审计或据此授予生产信任。
 * manifest 来源、镜像、Docker daemon、容器 HTTP 与探针 URL 均是外部边界，结果字段只陈述已执行阶段；未提供探针时不得推断出口阻断经过验证。
 * schema、daemon、拉取和启动失败映射为稳定 reasonCode，容器一旦创建，正常或异常路径都必须在 finally 中 stop 后 remove，避免烟测资源泄漏。
 * 阶段按顺序执行且单次只拥有一个容器；firewallConfigured、healthcheckPassed 与 nextStep 各有独立语义，调用方不得把 READY_FOR_LOCAL_AUDIT 等同于完整安全认证。
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
import { ManifestValidationError, loadManifestSource } from "../manifest/loadManifest";
import type { HealthcheckOptions } from "../docker/healthcheck";
import {
  verifyFirewallRules as defaultVerifyFirewallRules,
  type FirewallVerificationResult
} from "../network/firewallVerify";
import {
  probeEgress as defaultProbeEgress,
  type EgressProbeResult
} from "../network/egressProbe";
import type { SandboxManifest } from "../types/manifest";

export interface DockerSmokeCheckResult {
  manifestValid: boolean;
  dockerAvailable: boolean;
  serverVersion?: string;
  imagePulled?: boolean;
  containerStarted?: boolean;
  firewallConfigured?: boolean;
  blockedEgressTargetUrl?: string;
  undeclaredEgressBlocked?: boolean;
  egressProbeAvailable?: boolean;
  healthcheckPassed?: boolean;
  reasonCode?: string;
  detail?: string;
  nextStep?: "READY_FOR_LOCAL_AUDIT";
}

export interface RunDockerSmokeCheckOptions {
  manifestPath: string;
  blockedEgressTargetUrl?: string;
  checkDockerAvailability?: () => Promise<DockerAvailabilityResult>;
  pullImage?: (manifest: SandboxManifest) => Promise<void>;
  startContainer?: (manifest: SandboxManifest) => Promise<StartedContainer>;
  verifyFirewallRules?: (
    containerId: string,
    manifest: SandboxManifest
  ) => Promise<FirewallVerificationResult>;
  probeEgress?: (containerId: string, targetUrl: string) => Promise<EgressProbeResult>;
  waitForHealth?: (options: HealthcheckOptions) => Promise<void>;
  stopContainer?: (containerId: string) => Promise<void>;
  removeContainer?: (containerId: string) => Promise<void>;
}

export async function runDockerSmokeCheck(
  options: RunDockerSmokeCheckOptions
): Promise<DockerSmokeCheckResult> {
  let manifest: SandboxManifest;

  try {
    manifest = (await loadManifestSource(options.manifestPath)).manifest;
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      return {
        manifestValid: false,
        dockerAvailable: false,
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
      reasonCode: dockerAvailability.reason
    };
  }

  try {
    await (options.pullImage ?? defaultPullImage)(manifest);
  } catch (error) {
    return {
      manifestValid: true,
      dockerAvailable: true,
      serverVersion: dockerAvailability.serverVersion,
      imagePulled: false,
      containerStarted: false,
      healthcheckPassed: false,
      reasonCode: "IMAGE_PULL_FAILED",
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  let startedContainer: StartedContainer | undefined;

  try {
    startedContainer = await (options.startContainer ?? defaultStartContainer)(manifest);
  } catch (error) {
    return {
      manifestValid: true,
      dockerAvailable: true,
      serverVersion: dockerAvailability.serverVersion,
      imagePulled: true,
      containerStarted: false,
      healthcheckPassed: false,
      reasonCode: "CONTAINER_START_FAILED",
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  try {
    await (options.waitForHealth ?? defaultWaitForHealth)({
      host: startedContainer.host,
      port: startedContainer.port
    });
    const firewallVerification = await (options.verifyFirewallRules ?? defaultVerifyFirewallRules)(
      startedContainer.containerId,
      manifest
    );
    const egressProbe = options.blockedEgressTargetUrl
      ? await (options.probeEgress ?? defaultProbeEgress)(
          startedContainer.containerId,
          options.blockedEgressTargetUrl
        )
      : undefined;
    const egressProbeFields = options.blockedEgressTargetUrl
      ? {
          blockedEgressTargetUrl: options.blockedEgressTargetUrl,
          undeclaredEgressBlocked: !egressProbe!.reachable,
          egressProbeAvailable: egressProbe!.toolAvailable
        }
      : {};

    return {
      manifestValid: true,
      dockerAvailable: true,
      serverVersion: dockerAvailability.serverVersion,
      imagePulled: true,
      containerStarted: true,
      firewallConfigured: firewallVerification.configured,
      ...egressProbeFields,
      healthcheckPassed: true,
      nextStep: "READY_FOR_LOCAL_AUDIT"
    };
  } catch (error) {
    const firewallVerification = await (options.verifyFirewallRules ?? defaultVerifyFirewallRules)(
      startedContainer.containerId,
      manifest
    );
    const egressProbe = options.blockedEgressTargetUrl
      ? await (options.probeEgress ?? defaultProbeEgress)(
          startedContainer.containerId,
          options.blockedEgressTargetUrl
        )
      : undefined;
    const egressProbeFields = options.blockedEgressTargetUrl
      ? {
          blockedEgressTargetUrl: options.blockedEgressTargetUrl,
          undeclaredEgressBlocked: !egressProbe!.reachable,
          egressProbeAvailable: egressProbe!.toolAvailable
        }
      : {};
    return {
      manifestValid: true,
      dockerAvailable: true,
      serverVersion: dockerAvailability.serverVersion,
      imagePulled: true,
      containerStarted: true,
      firewallConfigured: firewallVerification.configured,
      ...egressProbeFields,
      healthcheckPassed: false,
      reasonCode:
        error instanceof Error && "reasonCode" in error && typeof error.reasonCode === "string"
          ? error.reasonCode
          : "AGENT_UNAVAILABLE",
      detail: error instanceof Error ? error.message : String(error)
    };
  } finally {
    await (options.stopContainer ?? defaultStopContainer)(startedContainer.containerId);
    await (options.removeContainer ?? defaultRemoveContainer)(startedContainer.containerId);
  };
}
