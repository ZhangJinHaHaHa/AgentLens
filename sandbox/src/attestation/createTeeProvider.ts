import type { AttestationServiceConfig } from "./readAttestationServiceConfig";
import {
  createCompositeAttestationQuoteValidator,
  createExpectedAttestationQuoteValidator,
  type AttestationQuoteValidator
} from "./attestationQuoteValidator";
import {
  createCommandTeeProvider,
  type CommandTeeProviderConfig
} from "./commandTeeProvider";
import { createMockTeeProvider, type TeeProvider } from "./mockTeeProvider";
import {
  createRealTeeHttpProvider,
  type RealTeeHttpProviderConfig
} from "./realTeeHttpProvider";
import { createSgxDcapQuoteValidator } from "./sgxDcapQuoteValidator";

export interface CreateTeeProviderDependencies {
  createCommandTeeProvider?: (config: CommandTeeProviderConfig) => TeeProvider;
  createMockTeeProvider?: typeof createMockTeeProvider;
  createRealTeeHttpProvider?: (config: RealTeeHttpProviderConfig) => TeeProvider;
}

function buildQuoteValidator(
  quoteValidation?: {
    expectedProviderType?: string;
    expectedMeasurement?: string;
    expectedQuoteFormat?: string;
  }
): AttestationQuoteValidator | undefined {
  if (!quoteValidation) {
    return undefined;
  }

  const validators: AttestationQuoteValidator[] = [
    createExpectedAttestationQuoteValidator(quoteValidation)
  ];

  if (quoteValidation.expectedQuoteFormat === "sgx-dcap-v3") {
    validators.push(
      createSgxDcapQuoteValidator({
        expectedMrEnclave: quoteValidation.expectedMeasurement
      })
    );
  }

  return validators.length === 1
    ? validators[0]
    : createCompositeAttestationQuoteValidator(validators);
}

export function createTeeProvider(
  config: AttestationServiceConfig,
  dependencies: CreateTeeProviderDependencies = {}
): TeeProvider {
  if (config.providerMode === "mock") {
    return (dependencies.createMockTeeProvider ?? createMockTeeProvider)();
  }

  if (config.providerMode === "command" && config.commandBackend) {
    return (dependencies.createCommandTeeProvider ?? createCommandTeeProvider)({
      ...config.commandBackend,
      quoteValidator: buildQuoteValidator(config.commandBackend.quoteValidation)
    });
  }

  if (config.providerMode === "real-http" && config.realBackend) {
    return (dependencies.createRealTeeHttpProvider ?? createRealTeeHttpProvider)({
      ...config.realBackend,
      quoteValidator: buildQuoteValidator(config.realBackend.quoteValidation)
    });
  }

  throw new Error(`Unsupported attestation provider mode: ${config.providerMode}`);
}
