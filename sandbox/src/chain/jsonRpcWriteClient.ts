import { BigNumber, Wallet } from "ethers";

export interface SubmitTransactionRequest {
  to: string;
  data: `0x${string}`;
  value?: bigint;
}

export interface TransactionReceiptResult {
  transactionHash: `0x${string}`;
  blockNumber: number;
  logs?: Array<{
    address: string;
    data: `0x${string}`;
    topics: `0x${string}`[];
  }>;
}

export interface JsonRpcWriteClient {
  submitTransaction(request: SubmitTransactionRequest): Promise<TransactionReceiptResult>;
}

export interface CreateJsonRpcWriteClientOptions {
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

interface JsonRpcSuccessResult<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

interface JsonRpcErrorResult {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
  };
}

interface RawTransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  status: string;
  logs?: Array<{
    address: string;
    data: string;
    topics: string[];
  }>;
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function parseRpcNumber(value: string): number {
  return Number.parseInt(stripHexPrefix(value), 16);
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function jsonRpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
  fetchImpl: typeof fetch
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

  const payload = (await response.json()) as JsonRpcSuccessResult<T> | JsonRpcErrorResult;
  if ("error" in payload) {
    throw new Error(`${method} returned JSON-RPC error ${payload.error.code}: ${payload.error.message}`);
  }

  if (!("result" in payload)) {
    throw new Error(`${method} response missing result`);
  }

  return payload.result;
}

async function waitForReceipt(
  rpcUrl: string,
  transactionHash: `0x${string}`,
  pollIntervalMs: number,
  fetchImpl: typeof fetch
): Promise<TransactionReceiptResult> {
  for (;;) {
    const receipt = await jsonRpcRequest<RawTransactionReceipt | null>(
      rpcUrl,
      "eth_getTransactionReceipt",
      [transactionHash],
      fetchImpl
    );

    if (!receipt) {
      await sleep(pollIntervalMs);
      continue;
    }

    if (receipt.status !== "0x1") {
      throw new Error(`transaction ${transactionHash} failed with receipt status ${receipt.status}`);
    }

    return {
      transactionHash,
      blockNumber: parseRpcNumber(receipt.blockNumber),
      logs: (receipt.logs ?? []).map((log) => ({
        address: log.address,
        data: log.data as `0x${string}`,
        topics: log.topics as `0x${string}`[]
      }))
    };
  }
}

export function createJsonRpcWriteClient(
  options: CreateJsonRpcWriteClientOptions
): JsonRpcWriteClient {
  const wallet = new Wallet(options.privateKey);
  const fetchImpl = options.fetchImpl ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const signerAddress = wallet.address.toLowerCase();

  return {
    async submitTransaction(request: SubmitTransactionRequest): Promise<TransactionReceiptResult> {
      const nonceHex = await jsonRpcRequest<string>(
        options.rpcUrl,
        "eth_getTransactionCount",
        [signerAddress, "pending"],
        fetchImpl
      );

      const gasLimitHex = await jsonRpcRequest<string>(
        options.rpcUrl,
        "eth_estimateGas",
        [
          {
            from: signerAddress,
            to: request.to,
            data: request.data,
            value: request.value === undefined ? undefined : `0x${request.value.toString(16)}`
          }
        ],
        fetchImpl
      );

      const gasPriceHex = await jsonRpcRequest<string>(
        options.rpcUrl,
        "eth_gasPrice",
        [],
        fetchImpl
      );

      const signedTransaction = await wallet.signTransaction({
        chainId: options.chainId,
        nonce: parseRpcNumber(nonceHex),
        gasLimit: BigNumber.from(gasLimitHex),
        gasPrice: BigNumber.from(gasPriceHex),
        to: request.to,
        data: request.data,
        value: BigNumber.from(request.value ?? 0n)
      });

      const transactionHash = await jsonRpcRequest<`0x${string}`>(
        options.rpcUrl,
        "eth_sendRawTransaction",
        [signedTransaction],
        fetchImpl
      );

      return waitForReceipt(options.rpcUrl, transactionHash, pollIntervalMs, fetchImpl);
    }
  };
}
