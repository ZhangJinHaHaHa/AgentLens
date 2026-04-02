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

function deriveHex(seed) {
  return createHash("sha256").update(seed).digest("hex");
}

const input = JSON.parse(await readStdin());
const seed = `${input.manifestHash}:${input.evidenceRoot}:${input.eventKey}:${input.tokenId}`;

process.stdout.write(
  JSON.stringify({
    measurement: deriveHex(`${seed}:measurement`),
    quoteFormat: "mock-quote",
    sessionPublicKey: `mock-session-${deriveHex(`${seed}:spk`).slice(0, 16)}`,
    quote: `mock-quote-${deriveHex(`${seed}:quote`)}`
  })
);
