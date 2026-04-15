import {
  generateDemoCommandAttestation,
  generateRealCommandAttestation,
  parseCommandAttestationRequest
} from "../attestation/commandProviderBackend";

async function readStdin(): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    process.stdin.on("error", reject);
  });
}

export interface AttestationCommandProviderCliDependencies {
  writeStdout?: (chunk: string) => void;
  readStdin?: () => Promise<string>;
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

export async function runAttestationCommandProviderCli(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  stdinText?: string,
  dependencies: AttestationCommandProviderCliDependencies = {}
): Promise<number> {
  const readInput =
    stdinText !== undefined ? async () => stdinText : dependencies.readStdin ?? readStdin;
  const writeStdout = dependencies.writeStdout ?? ((chunk: string) => process.stdout.write(chunk));

  const request = parseCommandAttestationRequest(await readInput());
  const response =
    env.TEE_COMMAND_PROVIDER_MODE === "real"
      ? await generateRealCommandAttestation(request, {
          command: env.TEE_COMMAND_PROVIDER_COMMAND || "",
          args: (env.TEE_COMMAND_PROVIDER_ARGS || "")
            .split(/\r?\n/u)
            .flatMap((line) => line.split(","))
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
          runCommand: dependencies.runCommand
        })
      : await generateDemoCommandAttestation(request, {
          quoteFormat: env.TEE_COMMAND_PROVIDER_QUOTE_FORMAT
        });

  writeStdout(JSON.stringify(response));
  return 0;
}

if (require.main === module) {
  void runAttestationCommandProviderCli(process.env).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
