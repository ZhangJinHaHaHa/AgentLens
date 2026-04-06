import {
  getAcceptanceExitCode,
  parseAcceptanceCliArgs,
  writeAcceptanceReport
} from "./acceptanceCommand";
import { runEgressAcceptanceCheck } from "../runtime/runEgressAcceptanceCheck";

async function main(): Promise<void> {
  const args = parseAcceptanceCliArgs(process.argv);

  const result = await runEgressAcceptanceCheck({
    manifestPath: args.manifestPath,
    allowedEgressTargetUrl: args.allowedEgressTargetUrl,
    blockedEgressTargetUrl: args.blockedEgressTargetUrl
  });

  if (args.outputPath) {
    await writeAcceptanceReport(args.outputPath, result);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = getAcceptanceExitCode(result);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
