import test from "node:test";
import assert from "node:assert/strict";

import { getLatestBlockNumber, parseAuditRequestedLog, pollAuditRequestedLogs } from "../../src/listener/pollAuditRequestedLogs";

interface RawAuditRequestedLogShape {
  address: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
  topics: string[];
  data: string;
}

function toHex(value: bigint, width = 64): string {
  return `0x${value.toString(16).padStart(width, "0")}`;
}

function encodeString(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  const lengthWord = Buffer.from(bytes.length.toString(16).padStart(64, "0"), "hex");
  const paddedLength = Math.ceil(bytes.length / 32) * 32;
  const paddedBytes = Buffer.alloc(paddedLength);
  bytes.copy(paddedBytes);
  return Buffer.concat([lengthWord, paddedBytes]).toString("hex");
}

function encodeAuditRequestedData(agentName: string, manifestUrl: string, bondAmount: bigint, timestamp: bigint): string {
  const agentChunk = encodeString(agentName);
  const manifestChunk = encodeString(manifestUrl);
  const headSize = 32n * 4n;
  const agentOffset = headSize;
  const manifestOffset = headSize + BigInt(agentChunk.length / 2);

  return `0x${[
    agentOffset.toString(16).padStart(64, "0"),
    manifestOffset.toString(16).padStart(64, "0"),
    bondAmount.toString(16).padStart(64, "0"),
    timestamp.toString(16).padStart(64, "0"),
    agentChunk,
    manifestChunk
  ].join("")}`;
}

function buildRawAuditRequestedLog(overrides: Partial<RawAuditRequestedLogShape> = {}): RawAuditRequestedLogShape {
  return {
    address: "0x000000000000000000000000000000000000aAaA",
    blockNumber: "0x7b",
    transactionHash: "0xabc123",
    logIndex: "0x0",
    topics: [
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      toHex(1n),
      toHex(0xdeadn, 64)
    ],
    data: encodeAuditRequestedData("risk-agent", "https://example.com/manifest.json", 10n, 1711111111n),
    ...overrides
  };
}

test("parseAuditRequestedLog decodes a valid AuditRequested-shaped log into the listener event model", () => {
  const parsed = parseAuditRequestedLog(buildRawAuditRequestedLog());

  assert.deepEqual(parsed, {
    eventKey: "0xabc123:0",
    tokenId: 1n,
    developer: "0x000000000000000000000000000000000000dead",
    agentName: "risk-agent",
    manifestUrl: "https://example.com/manifest.json",
    blockNumber: 123,
    transactionHash: "0xabc123"
  });
});

test("parseAuditRequestedLog rejects logs whose ABI layout does not match AuditRequested", () => {
  const parsed = parseAuditRequestedLog(
    buildRawAuditRequestedLog({
      data: `0x${[
        "0".repeat(63) + "2",
        "0".repeat(63) + "3",
        "0".repeat(64),
        "0".repeat(64)
      ].join("")}`
    })
  );

  assert.equal(parsed, undefined);
});

test("pollAuditRequestedLogs calls eth_getLogs with hex block filters and returns only decodable events", async () => {
  const rpcCalls: Array<{ method: string; params: unknown[] }> = [];

  const events = await pollAuditRequestedLogs({
    rpcUrl: "https://rpc.edge.local",
    contractAddress: "0x000000000000000000000000000000000000aAaA",
    fromBlock: 120,
    toBlock: 123,
    fetchImpl: async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      rpcCalls.push(body);

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: [
            buildRawAuditRequestedLog(),
            buildRawAuditRequestedLog({
              transactionHash: "0xignored",
              logIndex: "0x1",
              data: "0x1234"
            })
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
  });

  assert.deepEqual(rpcCalls, [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: "0x000000000000000000000000000000000000aAaA",
          fromBlock: "0x78",
          toBlock: "0x7b"
        }
      ]
    }
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventKey, "0xabc123:0");
});

test("getLatestBlockNumber reads eth_blockNumber and converts the hex result into a number", async () => {
  const latest = await getLatestBlockNumber({
    rpcUrl: "https://rpc.edge.local",
    fetchImpl: async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x7d" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
  });

  assert.equal(latest, 125);
});
