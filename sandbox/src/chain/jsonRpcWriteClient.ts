import { Wallet } from "ethers";

/**
 * 写客户端只接受已经编码的 calldata，并把 nonce、燃气估算、签名与回执轮询封装在同一提交周期内。
 * `to` 和 `data` 的语义正确性仍由上层合约适配器负责；本层不会验证目标合约或函数选择器。
 */
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
  // 该操作会产生外部链上副作用，不具备“调用一次等于调用多次”的幂等合同。
  submitTransaction(request: SubmitTransactionRequest): Promise<TransactionReceiptResult>;
}

export interface CreateJsonRpcWriteClientOptions {
  // rpcUrl 与 privateKey 同属高信任配置：节点决定待签名参数，私钥只应来自受控密钥注入边界。
  rpcUrl: string;
  chainId: number;
  privateKey: string;
  pollIntervalMs?: number;
  receiptTimeoutMs?: number;
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

// JSON-RPC quantity 使用十六进制字符串；解析后的安全范围由具体消费位置负责约束。
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
  // 每次调用都是独立 HTTP 请求，因此固定 id=1 只用于满足 JSON-RPC 2.0 形状，不承担批量请求关联。
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
    // HTTP 失败与 JSON-RPC error 都直接上抛；本层刻意不重试，以免写请求在结果未知时被重复广播。
    throw new Error(`JSON-RPC request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as JsonRpcSuccessResult<T> | JsonRpcErrorResult;
  // 节点响应是外部信任边界。这里只区分 error/result，不做完整运行时 schema 校验，后续解析仍可能抛错。
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
  receiptTimeoutMs: number,
  fetchImpl: typeof fetch
): Promise<TransactionReceiptResult> {
  // 超时预算从广播完成后开始计时；fetch 本身没有 AbortSignal，因此卡住的单次 RPC 不受该预算强制中断。
  const startedAt = Date.now();

  for (;;) {
    const receipt = await jsonRpcRequest<RawTransactionReceipt | null>(
      rpcUrl,
      "eth_getTransactionReceipt",
      [transactionHash],
      fetchImpl
    );

    if (!receipt) {
      // 仅“尚无回执”进入轮询重试；网络错误、节点错误和畸形响应会立即失败并保留给调用方决策。
      if (Date.now() - startedAt >= receiptTimeoutMs) {
        throw new Error(`timed out after ${receiptTimeoutMs}ms waiting for transaction ${transactionHash} receipt`);
      }

      const remainingMs = receiptTimeoutMs - (Date.now() - startedAt);
      await sleep(Math.min(pollIntervalMs, Math.max(remainingMs, 0)));
      continue;
    }

    if (receipt.status !== "0x1") {
      // status=0x1 只证明该区块中的 EVM 执行成功；这里不等待额外确认，也不提供链重组后的最终性保证。
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
  // Wallet 和配置由该客户端闭包持有；不会把私钥写盘，但进程内存与注入的 fetch 实现必须处于同一信任域。
  const wallet = new Wallet(options.privateKey);
  const fetchImpl = options.fetchImpl ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const receiptTimeoutMs = options.receiptTimeoutMs ?? 120_000;
  const signerAddress = wallet.address.toLowerCase();

  return {
    async submitTransaction(request: SubmitTransactionRequest): Promise<TransactionReceiptResult> {
      // nonce 每次从 pending 状态读取且客户端不设本地锁；同一签名者的并发提交必须由更高层串行化或统一管理 nonce。
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
        // 固定 type=0 与 eth_gasPrice 维持 legacy transaction 兼容性；迁移 EIP-1559 时必须同步调整费用与签名合同。
        type: 0,
        chainId: options.chainId,
        nonce: parseRpcNumber(nonceHex),
        gasLimit: BigInt(gasLimitHex),
        gasPrice: BigInt(gasPriceHex),
        to: request.to,
        data: request.data,
        value: request.value ?? 0n
      });

      const transactionHash = await jsonRpcRequest<`0x${string}`>(
        options.rpcUrl,
        "eth_sendRawTransaction",
        [signedTransaction],
        fetchImpl
      );

      // 广播成功后的唯一重试是按交易哈希查询回执；若发送 RPC 结果未知，调用方应先按 nonce/哈希对账，不能盲目重提业务动作。
      return waitForReceipt(options.rpcUrl, transactionHash, pollIntervalMs, receiptTimeoutMs, fetchImpl);
    }
  };
}
