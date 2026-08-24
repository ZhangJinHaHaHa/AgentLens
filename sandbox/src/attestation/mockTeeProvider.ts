/**
 * 该文件给出 TEE provider 的最小协议边界，并提供仅供本地/测试流程使用的确定性 mock 实现。
 * `AttestationRequest` 描述 provider 必须接收的审计绑定字段，返回值只描述 measurement、格式、会话公钥和 quote 的传输形态。
 * mock 有意忽略输入并返回固定占位值，因此它不证明事件绑定、硬件身份或 quote 完整性，绝不能被解释为生产可信结果。
 * 选择 mock 必须由上层显式配置；接口本身不负责模式授权、校验、网络调用或制品持久化。
 * 实现无外部状态且不会部分成功，因而没有重试或回滚语义。
 */
export interface AttestationRequest {
  schemaVersion: "audit-attestation-request.v1";
  eventKey: string;
  tokenId: string;
  manifestHash: string;
  evidenceRoot: string;
  manifestUrl: string;
}

export interface TeeProvider {
  attest(input: AttestationRequest): Promise<{
    measurement: string;
    quoteFormat: string;
    sessionPublicKey: string;
    quote: string;
  }>;
}

export function createMockTeeProvider(): TeeProvider {
  return {
    async attest(_input: AttestationRequest) {
      return {
        measurement: "a".repeat(64),
        quoteFormat: "mock-quote",
        sessionPublicKey: "mock-session-public-key",
        quote: "mock-attestation-quote"
      };
    }
  };
}
