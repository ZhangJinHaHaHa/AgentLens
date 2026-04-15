import test from "node:test";
import assert from "node:assert/strict";

import { createIpfsHttpClient } from "../../src/report/ipfsHttpClient";

interface CapturedRequest {
  input: RequestInfo | URL;
  init?: RequestInit;
}

function buildMockFetch(responseBody: unknown, captured: CapturedRequest[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ input, init });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
}

test("createIpfsHttpClient posts one multipart upload and reads the cid response", async () => {
  const captured: CapturedRequest[] = [];
  const client = createIpfsHttpClient({
    apiUrl: "https://ipfs.example/add",
    authToken: "token-123",
    fetchImpl: buildMockFetch(
      { cid: "bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq" },
      captured
    )
  });

  const result = await client.addToIpfs({
    body: Buffer.from('{"ok":true}'),
    fileName: "1-0xabc-0-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json"
  });

  assert.deepEqual(result, {
    cid: "bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq"
  });
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.input, "https://ipfs.example/add");
  assert.equal(captured[0]?.init?.method, "POST");

  const headers = captured[0]?.init?.headers as Record<string, string> | undefined;
  assert.equal(headers?.Authorization, "Bearer token-123");
  assert.equal(headers?.["content-type"], undefined);

  const body = captured[0]?.init?.body;
  assert.ok(body instanceof FormData);

  const file = body.get("file");
  assert.ok(file instanceof Blob);
  assert.equal(file.type, "application/json");
  assert.ok("name" in file);
  assert.equal((file as File).name, "1-0xabc-0-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.json");
  assert.equal(await file.text(), '{"ok":true}');
});

test("createIpfsHttpClient rejects responses without a real cid string", async () => {
  const client = createIpfsHttpClient({
    apiUrl: "https://ipfs.example/add",
    fetchImpl: buildMockFetch({ cid: "" }, [])
  });

  await assert.rejects(
    () =>
      client.addToIpfs({
        body: Buffer.from("{}"),
        fileName: "file.json"
      }),
    /cid is missing from IPFS response/
  );
});

test("createIpfsHttpClient accepts cid values outside the narrow bafy/Qm prefixes", async () => {
  const captured: CapturedRequest[] = [];
  const client = createIpfsHttpClient({
    apiUrl: "https://ipfs.example/add",
    fetchImpl: buildMockFetch({ cid: "zb2rhZfjRh2FHHB2RkHVEvL2vJnCTcu7kwRqgVsf9gpkLgteo" }, captured)
  });

  const result = await client.addToIpfs({
    body: Buffer.from("{}"),
    fileName: "file.json"
  });

  assert.deepEqual(result, { cid: "zb2rhZfjRh2FHHB2RkHVEvL2vJnCTcu7kwRqgVsf9gpkLgteo" });
});

test("createIpfsHttpClient rejects invalid cid strings", async () => {
  const client = createIpfsHttpClient({
    apiUrl: "https://ipfs.example/add",
    fetchImpl: buildMockFetch({ cid: "not-a-cid" }, [])
  });

  await assert.rejects(
    () =>
      client.addToIpfs({
        body: Buffer.from("{}"),
        fileName: "file.json"
      }),
    /cid is invalid in IPFS response/
  );
});
