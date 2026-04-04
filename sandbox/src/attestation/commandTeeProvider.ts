import { spawn } from "node:child_process";

import type { AttestationRequest, TeeProvider } from "./mockTeeProvider";
import {
  createNoopAttestationQuoteValidator,
  type AttestationQuoteValidator
} from "./attestationQuoteValidator";

export interface CommandTeeProviderConfig {
  command: string;
  args?: string[];
  providerType: string;
  timeoutMs: number;
  quoteValidator?: AttestationQuoteValidator;
  quoteValidation?: {
    expectedProviderType?: string;
    expectedMeasurement?: string;
    expectedQuoteFormat?: string;
  };
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

function requireString(value: unknown, field: string): string {
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

export function createCommandTeeProvider(config: CommandTeeProviderConfig): TeeProvider {
  const runCommand = config.runCommand ?? defaultRunCommand;
  const quoteValidator = config.quoteValidator ?? createNoopAttestationQuoteValidator();

  return {
    async attest(input: AttestationRequest) {
      const result = await runCommand({
        file: config.command,
        args: config.args ?? [],
        stdin: JSON.stringify(input)
      });

      if (result.exitCode !== 0) {
        throw new Error(
          `command TEE provider failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
        );
      }

      const payload = JSON.parse(result.stdout) as {
        measurement?: unknown;
        quoteFormat?: unknown;
        sessionPublicKey?: unknown;
        quote?: unknown;
      };

      const normalized = {
        measurement: requireString(payload.measurement, "measurement"),
        quoteFormat: requireString(payload.quoteFormat, "quoteFormat"),
        sessionPublicKey: requireString(payload.sessionPublicKey, "sessionPublicKey"),
        quote: requireString(payload.quote, "quote")
      };

      await quoteValidator.validate({
        providerType: config.providerType,
        ...normalized
      });

      return normalized;
    }
  };
}
