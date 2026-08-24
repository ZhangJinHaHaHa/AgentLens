/**
 * 本文件为离线/读取侧证明校验提供最窄的环境配置视图，使 provider、measurement、格式和 report_data 绑定策略与生成侧使用同一组变量名。
 * 未设置的期望保持 `undefined`，布尔开关只有精确字符串 `true` 才启用；这一定义保留了既有部署中“未显式开启即不执行绑定检查”的兼容语义。
 * 解析结果只是校验意图，不验证十六进制、quote 格式或变量间组合，也不会读取文件或接触网络。
 * 调用方必须把这些值交给实际 verifier；本模块既不声明证明可信，也不负责失败降级或恢复。
 * 函数只返回新对象且不改变环境记录，解析本身没有需要清理或回滚的资源。
 */
export interface AttestationVerifyConfig {
  expectedProviderType?: string;
  expectedMeasurement?: string;
  expectedQuoteFormat?: string;
  verifyReportDataBinding?: boolean;
}

export function readAttestationVerifyConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): AttestationVerifyConfig {
  return {
    expectedProviderType: env.AUDIT_ATTESTATION_EXPECTED_PROVIDER_TYPE,
    expectedMeasurement: env.AUDIT_ATTESTATION_EXPECTED_MEASUREMENT,
    expectedQuoteFormat: env.AUDIT_ATTESTATION_EXPECTED_QUOTE_FORMAT,
    verifyReportDataBinding: env.AUDIT_ATTESTATION_VERIFY_REPORT_DATA_BINDING === "true"
  };
}
