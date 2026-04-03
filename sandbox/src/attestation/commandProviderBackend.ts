import type { AttestationRequest } from "./mockTeeProvider";
import { spawn } from "node:child_process";

function requireString(value: unknown, field: keyof AttestationRequest): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }

  return value;
}

export function parseCommandAttestationRequest(raw: string): AttestationRequest {
  const parsed = JSON.parse(raw) as Partial<AttestationRequest>;
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

export async function generateDemoCommandAttestation(
  _input: AttestationRequest,
  options: { quoteFormat?: string } = {}
): Promise<{
  measurement: string;
  quoteFormat: string;
  sessionPublicKey: string;
  quote: string;
}> {
  return {
    measurement: "a".repeat(64),
    quoteFormat: options.quoteFormat ?? "mock-quote",
    sessionPublicKey: "mock-session-public-key",
    quote: "mock-attestation-quote"
  };
}

function requireResponseString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required in attestation response`);
  }

  return value;
}

async function defaultRunCommand(input: {
  file: string;
  args: string[];
  stdin: string;
}): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return await new Promise((resolve, reject) => {
    const child = spawn(input.file, input.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });

    child.stdin.write(input.stdin);
    child.stdin.end();
  });
}

export async function generateRealCommandAttestation(
  input: AttestationRequest,
  options: {
    command: string;
    args?: string[];
    runCommand?: (input: {
      file: string;
      args: string[];
      stdin: string;
    }) => Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
  }
): Promise<{
  measurement: string;
  quoteFormat: string;
  sessionPublicKey: string;
  quote: string;
}> {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const result = await runCommand({
    file: options.command,
    args: options.args ?? [],
    stdin: JSON.stringify(input)
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `command attestation backend failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
    );
  }

  const payload = JSON.parse(result.stdout) as {
    measurement?: unknown;
    quoteFormat?: unknown;
    sessionPublicKey?: unknown;
    quote?: unknown;
  };

  return {
    measurement: requireResponseString(payload.measurement, "measurement"),
    quoteFormat: requireResponseString(payload.quoteFormat, "quoteFormat"),
    sessionPublicKey: requireResponseString(payload.sessionPublicKey, "sessionPublicKey"),
    quote: requireResponseString(payload.quote, "quote")
  };
}
