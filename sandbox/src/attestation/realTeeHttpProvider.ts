/**
 * 该 provider 是证明服务到真实 TEE HTTP 后端的出站适配边界，负责传递标准请求、可选 Bearer 凭据并规范化后端响应。
 * backendUrl/令牌/providerType 来自受控部署配置，HTTP 状态和 JSON 载荷来自外部服务；四个必填字段及 quoteValidator 是输出获准返回前的最后门槛。
 * AbortController 限定单次调用时长，所有路径都会清理定时器；非成功状态、解析异常、字段缺失和 quote 校验失败均直接传播。
 * 本层不重试、不缓存、不落盘，也不承担 TLS 终止、远端身份/密钥轮换或完整 DCAP 证书链验证。
 * 请求可能已在远端产生副作用，客户端失败时无法回滚远端操作，因此调用方不得把自动重试假设为安全或幂等。
 */
import type { AttestationRequest, TeeProvider } from "./mockTeeProvider";
import {
  createNoopAttestationQuoteValidator,
  type AttestationQuoteValidator
} from "./attestationQuoteValidator";

export interface RealTeeHttpProviderConfig {
  backendUrl: string;
  authToken?: string;
  providerType: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  quoteValidator?: AttestationQuoteValidator;
  quoteValidation?: {
    expectedProviderType?: string;
    expectedMeasurement?: string;
    expectedQuoteFormat?: string;
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required in attestation response`);
  }

  return value;
}

export function createRealTeeHttpProvider(config: RealTeeHttpProviderConfig): TeeProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const quoteValidator = config.quoteValidator ?? createNoopAttestationQuoteValidator();

  return {
    async attest(input: AttestationRequest) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const headers: Record<string, string> = {
          "content-type": "application/json"
        };

        if (config.authToken) {
          headers.Authorization = `Bearer ${config.authToken}`;
        }

        const response = await fetchImpl(config.backendUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(input),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`real TEE backend request failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          measurement?: unknown;
          quoteFormat?: unknown;
          sessionPublicKey?: unknown;
          quote?: unknown;
        };

        const result = {
          measurement: requireString(payload.measurement, "measurement"),
          quoteFormat: requireString(payload.quoteFormat, "quoteFormat"),
          sessionPublicKey: requireString(payload.sessionPublicKey, "sessionPublicKey"),
          quote: requireString(payload.quote, "quote")
        };

        await quoteValidator.validate({
          providerType: config.providerType,
          ...result
        });

        return result;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}
