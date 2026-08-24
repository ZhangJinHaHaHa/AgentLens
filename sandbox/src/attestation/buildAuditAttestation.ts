/**
 * 该文件定义 `audit-attestation.v1` 的内存/序列化形态，并把一个已组装 bundle 固化为可寻址的审计证明制品。
 * 输入必须已经包含事件、manifest、evidence 与 verifier 的绑定字段；输出同时保留对象、缩进 JSON 原文及其 SHA-256 十六进制摘要。
 * 哈希覆盖这里生成的精确 JSON 字节，缩进、字段顺序或序列化规则的变化都会改变制品身份，因此现有格式属于持久化兼容契约。
 * 本模块不判断 quote 真伪、不重新计算 manifest/evidence，也不负责签名或落盘；这些信任门分别位于校验器和持久化层。
 * 构建过程是纯内存操作，失败时不会产生外部状态，也不存在回滚步骤。
 */
import { createHash } from "node:crypto";

import type { AuditRequestedEvent } from "../listener/types";

export interface AuditAttestationBundle {
  schemaVersion: "audit-attestation.v1";
  eventKey: string;
  tokenId: string;
  manifestHash: string;
  evidenceRoot: string;
  verifier: {
    type: string;
    measurement: string;
    quoteFormat: string;
    sessionPublicKey: string;
    quote: string;
  };
}

export interface AuditAttestationArtifact {
  attestationHash: string;
  bundle: AuditAttestationBundle;
  bundleJson: string;
}

export interface CreateAuditAttestationInput {
  event: AuditRequestedEvent;
  manifestHash: string;
  evidenceRoot: string;
}

export interface CreateAuditAttestationResult extends AuditAttestationArtifact {}

export function computeAuditAttestationHash(bundleJson: string): string {
  return createHash("sha256").update(bundleJson).digest("hex");
}

export function buildAuditAttestationArtifact(
  bundle: AuditAttestationBundle
): AuditAttestationArtifact {
  const bundleJson = JSON.stringify(bundle, null, 2);

  return {
    attestationHash: computeAuditAttestationHash(bundleJson),
    bundle,
    bundleJson
  };
}
