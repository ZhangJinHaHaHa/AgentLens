import { runDockerSmokeCheck } from "../runtime/runDockerSmokeCheck";

async function main(): Promise<void> {
  const manifestArgIndex = process.argv.indexOf("--manifest");
  const manifestPath = manifestArgIndex >= 0 ? process.argv[manifestArgIndex + 1] : undefined;
  const blockedTargetArgIndex = process.argv.indexOf("--blocked-egress-target");
  const blockedEgressTargetUrl =
    blockedTargetArgIndex >= 0 ? process.argv[blockedTargetArgIndex + 1] : undefined;

  if (!manifestPath) {
    throw new Error("Usage: npm run run:smoke -- --manifest ./path/to/manifest.json|https://example.com/manifest.json");
  }

  const result = await runDockerSmokeCheck({ manifestPath, blockedEgressTargetUrl });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
