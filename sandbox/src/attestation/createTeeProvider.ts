/**
 * 这是证明 provider 的组装根：把已解析的服务配置映射到 mock、命令或真实 HTTP 实现，并为真实输出装配期望值/SGX 校验链。
 * 输入配置位于部署信任域，输出只承诺统一 `TeeProvider` 接口；本函数本身不发网络请求、不启动进程，也不生成或持久化证明。
 * 当声明 `sgx-dcap-v3` 时会在通用元数据匹配之后追加 DCAP 结构校验，确保格式选择不会绕开更严格的检查。
 * 模式缺少配套后端或无法识别时必须 fail closed；依赖注入仅为测试和替换适配器保留兼容缝隙，不能放宽模式选择规则。
 * 组装失败发生在任何 provider 副作用之前，因此无需回滚；运行期故障语义由被选中的实现负责。
 */
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
