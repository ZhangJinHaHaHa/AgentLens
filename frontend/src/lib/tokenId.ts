/**
 * 将表单或 URL 中的 token 文本收敛为非空十进制表示和 bigint，失败时返回稳定错误对象而不是让 `BigInt` 异常越过界面边界。
 * 解析会裁剪外围空白但保留合法输入的原始前导零字符串；数值输出用于合约调用，模块不查询链、不缓存也不自动重试。
 * 正则只验证语法，零、超大值或尚未铸造的 ID 仍可通过；存在性、业务权限和目标网络必须由权威合约读取确认。
 * 非数字、符号、小数、十六进制和空值统一失败，这一严格十进制约定保证深链与表单错误文案兼容。
 */
export type TokenIdParseResult =
  | {
      ok: true;
      normalized: string;
      value: bigint;
    }
  | {
      ok: false;
      error: string;
    };

const TOKEN_ID_ERROR = "Token ID must be a non-empty decimal string.";

export function parseTokenIdInput(input: string): TokenIdParseResult {
  const normalized = input.trim();

  if (!/^\d+$/.test(normalized)) {
    return {
      ok: false,
      error: TOKEN_ID_ERROR
    };
  }

  return {
    ok: true,
    normalized,
    value: BigInt(normalized)
  };
}
