import type { AuditRequestedEvent } from "./types";

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
  return Number.parseInt(stripHexPrefix(value), 16);
}

function parseHexBigInt(value: string): bigint {
  return BigInt(`0x${stripHexPrefix(value)}`);
}

function decodeAddressTopic(topic: string): string | undefined {
  const normalized = stripHexPrefix(topic);
  if (normalized.length !== 64) {
    return undefined;
  }

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

  return Buffer.from(dataHex.slice(bytesStart, bytesEnd), "hex").toString("utf8");
}

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
  if (log.topics.length < 3) {
    return undefined;
  }

  const tokenTopic = log.topics[1];
  const developerTopic = log.topics[2];
  if (!tokenTopic || !developerTopic) {
    return undefined;
  }

  const dataHex = stripHexPrefix(log.data);
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

  if (!agentName || !manifestUrl || !developer) {
    return undefined;
  }

  return {
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
  const latestHex = await jsonRpcRequest<string>(options.rpcUrl, "eth_blockNumber", [], options.fetchImpl);
  return parseHexNumber(latestHex);
}

export async function pollAuditRequestedLogs(
  options: PollAuditRequestedLogsOptions
): Promise<AuditRequestedEvent[]> {
  const rawLogs = await jsonRpcRequest<RawRpcLog[]>(
    options.rpcUrl,
    "eth_getLogs",
    [
      {
        address: options.contractAddress,
        fromBlock: toRpcHex(options.fromBlock),
        toBlock: toRpcHex(options.toBlock)
      }
    ],
    options.fetchImpl
  );

  return rawLogs
    .map((log) => parseAuditRequestedLog(log))
    .filter((event): event is AuditRequestedEvent => event !== undefined);
}
