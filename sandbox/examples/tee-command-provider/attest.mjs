#!/usr/bin/env node

import { createHash } from "node:crypto";

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", reject);
  });
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }

  return value;
}

function parseRequest(raw) {
  const parsed = JSON.parse(raw);
  if (parsed.schemaVersion !== "audit-attestation-request.v1") {
    throw new Error("schemaVersion must be audit-attestation-request.v1");
  }

  return {
    schemaVersion: "audit-attestation-request.v1",
    eventKey: requireString(parsed.eventKey, "eventKey"),
    tokenId: requireString(parsed.tokenId, "tokenId"),
    manifestHash: requireString(parsed.manifestHash, "manifestHash"),
    evidenceRoot: requireString(parsed.evidenceRoot, "evidenceRoot"),
    manifestUrl: requireString(parsed.manifestUrl, "manifestUrl")
  };
}

function deriveHex(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

async function generateDemoAttestation(input) {
  const seed = `${input.manifestHash}:${input.evidenceRoot}:${input.eventKey}:${input.tokenId}`;
  return {
    measurement: deriveHex(`${seed}:measurement`),
    quoteFormat: process.env.TEE_COMMAND_PROVIDER_QUOTE_FORMAT || "mock-quote",
    sessionPublicKey: `demo-session-${deriveHex(`${seed}:spk`).slice(0, 16)}`,
    quote: `demo-quote-${deriveHex(`${seed}:quote`)}`
  };
}

async function generateRealAttestation(input) {
  // Replace this function with your real TEE platform integration.
  // Keep the return shape unchanged.
  return generateDemoAttestation(input);
}

async function main() {
  const request = parseRequest(await readStdin());
  const response =
    process.env.TEE_COMMAND_PROVIDER_MODE === "real"
      ? await generateRealAttestation(request)
      : await generateDemoAttestation(request);

  process.stdout.write(JSON.stringify(response));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
