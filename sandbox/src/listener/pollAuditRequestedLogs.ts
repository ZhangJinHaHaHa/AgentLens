import type { AuditRequestedEvent } from "./types";

/**
 * 这是节点返回日志的最小传输投影，所有字段仍是不可信字符串；类型断言不替代运行时验证。
 * 当前模型也不包含 removed 标记或 blockHash，因此本层无法识别链重组撤销，确认深度策略必须由
 * 选择 fromBlock/toBlock 的上层负责。
 */
export interface RawRpcLog {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  topics: string[];
  data: string;
}

export interface GetLatestBlockNumberOptions {
  rpcUrl: string;
  fetchImpl?: typeof fetch;
}

export interface PollAuditRequestedLogsOptions extends GetLatestBlockNumberOptions {
  contractAddress: string;
  fromBlock: number;
  toBlock: number;
}

interface JsonRpcSuccessResult<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function toRpcHex(value: number): string {
  return `0x${value.toString(16)}`;
}

function parseHexNumber(value: string): number {
  // 区块号和 logIndex 被降为 number 以兼容现有事件模型；调用方依赖节点返回可安全表示的规范十六进制值。
  return Number.parseInt(stripHexPrefix(value), 16);
}

function parseHexBigInt(value: string): bigint {
  // tokenId 保留 bigint，避免 uint256 精度损失；畸形十六进制会抛错并使本轮轮询失败，而不是被静默改写。
  return BigInt(`0x${stripHexPrefix(value)}`);
}

function decodeAddressTopic(topic: string): string | undefined {
  const normalized = stripHexPrefix(topic);
  if (normalized.length !== 64) {
    return undefined;
  }

  // indexed address 按 ABI 左侧补零占满 32 字节，规范化为小写仅用于稳定比较，不校验校验和大小写。
  return `0x${normalized.slice(24).toLowerCase()}`;
}

function readWord(dataHex: string, offsetBytes: number): string | undefined {
  const start = offsetBytes * 2;
  const end = start + 64;

  if (end > dataHex.length) {
    return undefined;
  }

  return dataHex.slice(start, end);
}

function decodeString(dataHex: string, offsetWord: string): string | undefined {
  // 动态偏移必须落在 32 字节边界，并同时验证实际字节与 ABI padding 边界，防止越界截断被当成有效字符串。
  const offsetBytes = Number.parseInt(offsetWord, 16);
  if (!Number.isInteger(offsetBytes) || offsetBytes < 0 || offsetBytes % 32 !== 0) {
    return undefined;
  }

  const lengthWord = readWord(dataHex, offsetBytes);
  if (!lengthWord) {
    return undefined;
  }

  const byteLength = Number.parseInt(lengthWord, 16);
  if (!Number.isInteger(byteLength) || byteLength < 0) {
    return undefined;
  }

  const bytesStart = offsetBytes * 2 + 64;
  const bytesEnd = bytesStart + byteLength * 2;
  const paddedBytesEnd = bytesStart + Math.ceil(byteLength / 32) * 64;

  if (paddedBytesEnd > dataHex.length || bytesEnd > dataHex.length) {
    return undefined;
  }

  // Buffer 按 UTF-8 解码；上层还会拒绝空 agentName/manifestUrl，但不会在这里判断 URL 协议或业务语义。
  return Buffer.from(dataHex.slice(bytesStart, bytesEnd), "hex").toString("utf8");
}

/**
 * 统一封装只负责 JSON-RPC 传输错误：HTTP 错误、协议 error 与 JSON 解析异常均向上传播。
 * result 的具体形状由各调用点消费，本函数不实现超时、限流、节点切换或重试，以避免传输层与
 * 监听游标的重放策略产生两套所有者。
 */
async function jsonRpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  if (!response.ok) {
    throw new Error(`JSON-RPC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as
    | JsonRpcSuccessResult<T>
    | { jsonrpc: "2.0"; id: number; error: { code: number; message: string } };

  if ("error" in payload) {
    throw new Error(`JSON-RPC error (${payload.error.code}): ${payload.error.message}`);
  }

  return payload.result;
}

export function parseAuditRequestedLog(log: RawRpcLog): AuditRequestedEvent | undefined {
  /**
   * 解析器按当前 AuditRequested ABI 的位置约定读取 topics[1]/topics[2] 和两个动态字符串。
   * 它没有核验 topics[0] 事件签名；pollAuditRequestedLogs 也只按合约地址过滤，因此兼容前提是该地址
   * 的其他事件不会伪装成同一布局。升级合约事件时必须同步增加签名过滤或更新此解码规则。
   */
  if (log.topics.length < 3) {
    return undefined;
  }

  const tokenTopic = log.topics[1];
  const developerTopic = log.topics[2];
  if (!tokenTopic || !developerTopic) {
    return undefined;
  }

  const dataHex = stripHexPrefix(log.data);
  // 四个 head word 对应两个动态偏移及当前事件的其余静态字段；尾部动态区仍按各自偏移独立校验。
  if (dataHex.length < 64 * 4 || dataHex.length % 64 !== 0) {
    return undefined;
  }

  const agentOffsetWord = readWord(dataHex, 0);
  const manifestOffsetWord = readWord(dataHex, 32);
  if (!agentOffsetWord || !manifestOffsetWord) {
    return undefined;
  }

  const agentName = decodeString(dataHex, agentOffsetWord);
  const manifestUrl = decodeString(dataHex, manifestOffsetWord);
  const developer = decodeAddressTopic(developerTopic);

  // 结构不可解码的日志返回 undefined，由批量轮询过滤；这会跳过该日志而不是阻塞整个区块。
  if (!agentName || !manifestUrl || !developer) {
    return undefined;
  }

  return {
    // 交易哈希与日志序号共同标识一次日志投递；该键在同一条规范链上稳定，但自身不携带 blockHash。
    eventKey: `${log.transactionHash}:${parseHexNumber(log.logIndex)}`,
    tokenId: parseHexBigInt(tokenTopic),
    developer,
    agentName,
    manifestUrl,
    blockNumber: parseHexNumber(log.blockNumber),
    transactionHash: log.transactionHash
  };
}

export async function getLatestBlockNumber(options: GetLatestBlockNumberOptions): Promise<number> {
  // latest 是节点即时高度而非最终确认高度；本函数只做格式转换，不施加确认窗口。
  const latestHex = await jsonRpcRequest<string>(options.rpcUrl, "eth_blockNumber", [], options.fetchImpl);
  return parseHexNumber(latestHex);
}

export async function pollAuditRequestedLogs(
  options: PollAuditRequestedLogsOptions
): Promise<AuditRequestedEvent[]> {
  // 单次 eth_getLogs 覆盖完整闭区间且不分页；提供方的最大区块范围限制会作为错误交给外层整轮重试。
  const rawLogs = await jsonRpcRequest<RawRpcLog[]>(
    options.rpcUrl,
    "eth_getLogs",
    [
      {
        address: options.contractAddress,
        // 只限定合约地址而未指定事件 topic，是与现有部署的兼容行为；解析器承担布局筛选。
        fromBlock: toRpcHex(options.fromBlock),
        toBlock: toRpcHex(options.toBlock)
      }
    ],
    options.fetchImpl
  );

  // 保持节点给出的日志顺序；不可解码项被丢弃，调用方仍可能推进游标，因此应把节点/ABI 配置视为受控输入。
  return rawLogs
    .map((log) => parseAuditRequestedLog(log))
    .filter((event): event is AuditRequestedEvent => event !== undefined);
}
