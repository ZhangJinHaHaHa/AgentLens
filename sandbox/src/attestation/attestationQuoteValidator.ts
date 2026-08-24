/**
 * 本模块定义 quote 校验器的组合契约，并提供对 provider 类型、measurement 与格式标识进行精确匹配的策略。
 * 输入是尚未被信任的 provider 元数据和 quote；成功只表示所有已配置策略均接受，输出刻意为空以避免把校验过程误当成数据转换。
 * 期望值校验不解析 quote、也不验证签名或证书链，真正的 SGX 结构与绑定检查由专用 validator 追加完成。
 * 组合器按声明顺序执行并在首个失败处终止，稳定错误码供调用方区分策略不匹配；全部校验均不得修改输入或留下需要回滚的状态。
 * noop 实现用于明确选择“不做 quote 校验”的兼容/测试场景，而不是生产可信性的证明。
 */
export interface AttestationQuoteValidationInput {
  providerType: string;
  measurement: string;
  quoteFormat: string;
  sessionPublicKey: string;
  quote: string;
}

export type AttestationQuoteValidationErrorCode =
  | "PROVIDER_TYPE_MISMATCH"
  | "MEASUREMENT_MISMATCH"
  | "QUOTE_FORMAT_MISMATCH";

export class AttestationQuoteValidationError extends Error {
  code: AttestationQuoteValidationErrorCode;

  constructor(code: AttestationQuoteValidationErrorCode, message: string) {
    super(message);
    this.name = "AttestationQuoteValidationError";
    this.code = code;
  }
}

export interface AttestationQuoteValidator {
  validate(input: AttestationQuoteValidationInput): Promise<void>;
}

export function createNoopAttestationQuoteValidator(): AttestationQuoteValidator {
  return {
    async validate(): Promise<void> {}
  };
}

export function createCompositeAttestationQuoteValidator(
  validators: AttestationQuoteValidator[]
): AttestationQuoteValidator {
  return {
    async validate(input: AttestationQuoteValidationInput): Promise<void> {
      for (const validator of validators) {
        await validator.validate(input);
      }
    }
  };
}

export function createExpectedAttestationQuoteValidator(expectations: {
  expectedProviderType?: string;
  expectedMeasurement?: string;
  expectedQuoteFormat?: string;
}): AttestationQuoteValidator {
  return {
    async validate(input: AttestationQuoteValidationInput): Promise<void> {
      if (
        expectations.expectedProviderType &&
        input.providerType !== expectations.expectedProviderType
      ) {
        throw new AttestationQuoteValidationError(
          "PROVIDER_TYPE_MISMATCH",
          "providerType does not match expected value"
        );
      }

      if (
        expectations.expectedMeasurement &&
        input.measurement !== expectations.expectedMeasurement
      ) {
        throw new AttestationQuoteValidationError(
          "MEASUREMENT_MISMATCH",
          "measurement does not match expected value"
        );
      }

      if (
        expectations.expectedQuoteFormat &&
        input.quoteFormat !== expectations.expectedQuoteFormat
      ) {
        throw new AttestationQuoteValidationError(
          "QUOTE_FORMAT_MISMATCH",
          "quoteFormat does not match expected value"
        );
      }
    }
  };
}
