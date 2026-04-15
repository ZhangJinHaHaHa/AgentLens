import { createLocalAuditRunOptions } from "./localAuditOptions";
import { runLocalSandboxAudit } from "../runtime/runLocalSandboxAudit";

async function main(): Promise<void> {
  const manifestArgIndex = process.argv.indexOf("--manifest");
  const manifestPath = manifestArgIndex >= 0 ? process.argv[manifestArgIndex + 1] : undefined;

  if (!manifestPath) {
    throw new Error("Usage: npm run run:local -- --manifest ./path/to/manifest.json|https://example.com/manifest.json");
  }

  const result = await runLocalSandboxAudit(createLocalAuditRunOptions(manifestPath));

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
