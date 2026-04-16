import test from "node:test";
import assert from "node:assert/strict";

import { utils } from "ethers";

import { createJsonRpcWriteClient } from "../../src/chain/jsonRpcWriteClient";

interface RpcRequestPayload {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

function buildMockFetch(
  responses: unknown[],
  capturedRequests: RpcRequestPayload[]
): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawBody = init?.body;
    if (typeof rawBody !== "string") {
      throw new Error("expected JSON body string");
    }

    capturedRequests.push(JSON.parse(rawBody) as RpcRequestPayload);

    if (responses.length === 0) {
      throw new Error("received unexpected JSON-RPC request");
    }

    return new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: {
        "content-type": "application/json"
      }
    });
  }) as typeof fetch;
}

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SIGNER_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const CONTRACT_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_CHAIN_ID = 31337;
const TEST_NONCE_HEX = "0x7";
const TEST_GAS_LIMIT_HEX = "0x5208";
const TEST_GAS_PRICE_HEX = "0x3b9aca00";

const contractInterface = new utils.Interface([
  "function recordAuditResult(uint256 tokenId,uint256 auditScore,uint256 memoryPeakMb,uint256 cpuAvgMilli,uint256 requestIpCount,uint8 status,bytes32 manifestHash,bytes32 reportHash,bytes32 evidenceRoot,bytes32 attestationHash,string evidenceCID,string reportCID,string manifestUrl)",
  "event AuditRecorded(uint256 indexed tokenId,uint64 indexed auditId,uint8 status,uint32 auditScore,bytes32 reportHash,string reportCID)"
]);

const RECORD_AUDIT_RESULT_CALL_DATA = contractInterface.encodeFunctionData("recordAuditResult", [
  1,
  100,
  256,
  120,
  1,
  1,
  `0x${"a".repeat(64)}`,
  `0x${"b".repeat(64)}`,
  `0x${"e".repeat(64)}`,
  `0x${"0".repeat(64)}`,
  "bafy-evidence",
  "bafybeigdyrzt",
  "https://example.com/manifest.json"
]) as `0x${string}`;

test("createJsonRpcWriteClient sends a signed raw transaction and waits for a successful receipt", async () => {
  const txHash = `0x${"f".repeat(64)}`;
  const auditRecordedLog = contractInterface.encodeEventLog(
    contractInterface.getEvent("AuditRecorded"),
    [1, 7, 1, 100, `0x${"b".repeat(64)}`, "bafybeigdyrzt"]
  );
  const capturedRequests: RpcRequestPayload[] = [];
  const fetchImpl = buildMockFetch(
    [
      { jsonrpc: "2.0", id: 1, result: TEST_NONCE_HEX },
      { jsonrpc: "2.0", id: 1, result: TEST_GAS_LIMIT_HEX },
      { jsonrpc: "2.0", id: 1, result: TEST_GAS_PRICE_HEX },
      { jsonrpc: "2.0", id: 1, result: txHash },
      { jsonrpc: "2.0", id: 1, result: null },
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          transactionHash: txHash,
          blockNumber: "0x10",
          status: "0x1",
          logs: [
            {
              address: CONTRACT_ADDRESS,
              data: auditRecordedLog.data,
              topics: auditRecordedLog.topics
            }
          ]
        }
      }
    ],
    capturedRequests
  );

  const client = createJsonRpcWriteClient({
    rpcUrl: "http://localhost:8545",
    chainId: TEST_CHAIN_ID,
    privateKey: PRIVATE_KEY,
    pollIntervalMs: 0,
    fetchImpl
  });

  const receipt = await client.submitTransaction({
    to: CONTRACT_ADDRESS,
    data: RECORD_AUDIT_RESULT_CALL_DATA
  });

  assert.deepEqual(receipt, {
    transactionHash: txHash,
    blockNumber: 16,
    logs: [
      {
        address: CONTRACT_ADDRESS,
        data: auditRecordedLog.data,
        topics: auditRecordedLog.topics
      }
    ]
  });

  assert.deepEqual(
    capturedRequests.map((request) => request.method),
    [
      "eth_getTransactionCount",
      "eth_estimateGas",
      "eth_gasPrice",
      "eth_sendRawTransaction",
      "eth_getTransactionReceipt",
      "eth_getTransactionReceipt"
    ]
  );

  assert.deepEqual(capturedRequests[0]?.params, [SIGNER_ADDRESS, "pending"]);

  const estimateParams = capturedRequests[1]?.params as [
    {
      from: string;
      to: string;
      data: string;
    }
  ];
  assert.equal(estimateParams[0]?.from.toLowerCase(), SIGNER_ADDRESS);
  assert.equal(estimateParams[0]?.to.toLowerCase(), CONTRACT_ADDRESS);
  assert.equal(estimateParams[0]?.data, RECORD_AUDIT_RESULT_CALL_DATA);
  assert.deepEqual(capturedRequests[2]?.params, []);

  const signedRawTx = (capturedRequests[3]?.params as [string])[0];
  const parsedTx = utils.parseTransaction(signedRawTx);
  assert.equal(parsedTx.to?.toLowerCase(), CONTRACT_ADDRESS);
  assert.equal(parsedTx.data, RECORD_AUDIT_RESULT_CALL_DATA);
  assert.equal(parsedTx.nonce, 7);
  assert.equal(parsedTx.chainId, TEST_CHAIN_ID);
  assert.equal(parsedTx.gasLimit?.toHexString(), TEST_GAS_LIMIT_HEX);
  assert.equal(parsedTx.gasPrice?.toHexString(), TEST_GAS_PRICE_HEX);
  assert.equal(parsedTx.from?.toLowerCase(), SIGNER_ADDRESS);
});

test("createJsonRpcWriteClient throws a clear error when the mined receipt has status 0x0", async () => {
  const txHash = `0x${"e".repeat(64)}`;
  const fetchImpl = buildMockFetch(
    [
      { jsonrpc: "2.0", id: 1, result: TEST_NONCE_HEX },
      { jsonrpc: "2.0", id: 1, result: TEST_GAS_LIMIT_HEX },
      { jsonrpc: "2.0", id: 1, result: TEST_GAS_PRICE_HEX },
      { jsonrpc: "2.0", id: 1, result: txHash },
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          transactionHash: txHash,
          blockNumber: "0x20",
          status: "0x0"
        }
      }
    ],
    []
  );

  const client = createJsonRpcWriteClient({
    rpcUrl: "http://localhost:8545",
    chainId: TEST_CHAIN_ID,
    privateKey: PRIVATE_KEY,
    pollIntervalMs: 0,
    fetchImpl
  });

  await assert.rejects(
    () =>
      client.submitTransaction({
        to: CONTRACT_ADDRESS,
        data: RECORD_AUDIT_RESULT_CALL_DATA
      }),
    /transaction .* failed/i
  );
});

test("createJsonRpcWriteClient throws a clear error when JSON-RPC omits result", async () => {
  const fetchImpl = buildMockFetch([{ jsonrpc: "2.0", id: 1 }], []);
  const client = createJsonRpcWriteClient({
    rpcUrl: "http://localhost:8545",
    chainId: TEST_CHAIN_ID,
    privateKey: PRIVATE_KEY,
    pollIntervalMs: 0,
    fetchImpl
  });

  await assert.rejects(
    () =>
      client.submitTransaction({
        to: CONTRACT_ADDRESS,
        data: RECORD_AUDIT_RESULT_CALL_DATA
      }),
    /eth_getTransactionCount.*missing result/i
  );
});
