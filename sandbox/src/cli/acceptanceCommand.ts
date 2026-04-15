import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EgressAcceptanceResult } from "../runtime/runEgressAcceptanceCheck";

export interface AcceptanceCliArgs {
  manifestPath: string;
  allowedEgressTargetUrl: string;
  blockedEgressTargetUrl: string;
  outputPath?: string;
}

export function parseAcceptanceCliArgs(argv: string[]): AcceptanceCliArgs {
  const manifestArgIndex = argv.indexOf("--manifest");
  const manifestPath = manifestArgIndex >= 0 ? argv[manifestArgIndex + 1] : undefined;
  const allowedTargetArgIndex = argv.indexOf("--allowed-egress-target");
  const allowedEgressTargetUrl =
    allowedTargetArgIndex >= 0 ? argv[allowedTargetArgIndex + 1] : undefined;
  const blockedTargetArgIndex = argv.indexOf("--blocked-egress-target");
  const blockedEgressTargetUrl =
    blockedTargetArgIndex >= 0 ? argv[blockedTargetArgIndex + 1] : undefined;
  const outputArgIndex = argv.indexOf("--output");
  const outputPath = outputArgIndex >= 0 ? argv[outputArgIndex + 1] : undefined;

  if (!manifestPath || !allowedEgressTargetUrl || !blockedEgressTargetUrl) {
    throw new Error(
      "Usage: npm run run:acceptance -- --manifest ./path/to/manifest.json|https://example.com/manifest.json --allowed-egress-target https://allowed.example --blocked-egress-target https://blocked.example [--output ./path/to/report.json]"
    );
  }

  return {
    manifestPath,
    allowedEgressTargetUrl,
    blockedEgressTargetUrl,
    outputPath
  };
}

export function getAcceptanceExitCode(result: EgressAcceptanceResult): number {
  return result.accepted ? 0 : 1;
}

export async function writeAcceptanceReport(
  outputPath: string,
  result: EgressAcceptanceResult
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
