/**
 * 链上时间、地址、分数、保证金和租赁价格的展示格式集合；输入为 bigint/number/string，输出面向当前 UI 的普通字符串。
 * 除 `toLocaleString` 读取宿主语言/时区外均为局部计算，不写状态、不缓存、不联网，也没有失败重试；浏览器与服务端可能呈现不同时间格式。
 * 时间的非有限/非正值回退 Unknown，日期构造异常回退原秒值；地址只截断长度，不验证 EVM 格式或所有权。
 * wei 转 ETH 经 `Number` 是有损展示，且 bond 必须能安全转换为 bigint；精度和阈值不能用于签名金额、账务或结算，交易边界应保留原值。
 * 文案、截断位数和小数位是页面快照兼容规则，若需确定性 SSR 或本地化货币应由调用方提供更严格 formatter。
 */
export function formatTimestamp(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Unknown";
  }

  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(unixSeconds);
  }
}

export function truncateAddress(address: string, leading = 6, trailing = 4): string {
  if (address.length <= leading + trailing + 2) {
    return address;
  }

  return `${address.slice(0, leading)}...${address.slice(-trailing)}`;
}

export function formatScore(score: bigint | number): string {
  return String(Number(score));
}

export function formatBondWei(bond: bigint | number): string {
  const value = BigInt(bond);
  const eth = Number(value) / 1e18;

  if (eth >= 0.001) {
    return `${eth.toFixed(4)} ETH`;
  }

  return `${String(value)} wei`;
}

export function formatPriceEth(weiValue: bigint): string {
  const eth = Number(weiValue) / 1e18;

  if (eth === 0) {
    return "Free";
  }
  if (eth < 0.0001) {
    return `${weiValue.toString()} wei`;
  }
  if (eth >= 1) {
    return `${eth.toFixed(2)} ETH`;
  }
  if (eth >= 0.01) {
    return `${eth.toFixed(3)} ETH`;
  }
  return `${eth.toFixed(4)} ETH`;
}
