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
