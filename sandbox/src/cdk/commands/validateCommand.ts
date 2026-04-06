import crypto from "node:crypto";
import fs from "node:fs";

import { validateManifest } from "../../manifest/schema";
import { runDockerSmokeCheck } from "../../runtime/runDockerSmokeCheck";
import { printSuccess, printError, printInfo, printKeyValue, printHeader, dim } from "../util/formatOutput";

export interface ValidateCommandOptions {
  manifest?: string;
  docker: boolean;
}

export async function runValidateCommand(options: ValidateCommandOptions): Promise<void> {
  const manifestPath = options.manifest ?? "manifest.json";

  let contents: string;
  try {
    contents = fs.readFileSync(manifestPath, "utf8");
  } catch {
    printError(`Cannot read manifest file: ${manifestPath}`);
    process.exitCode = 1;
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    printError("Manifest is not valid JSON");
    process.exitCode = 1;
    return;
  }

  try {
    const manifest = validateManifest(parsed);

    const hash = crypto.createHash("sha256").update(contents).digest("hex");

    printHeader("Manifest Validation");
    printSuccess("Schema validation passed");
    printKeyValue("Agent Name", manifest.agent_name);
    printKeyValue("Image", manifest.image);
    printKeyValue("Allowed Hosts", manifest.allowed_hosts.join(", "));
    printKeyValue("RPC Endpoints", manifest.allowed_rpc_endpoints.join(", "));
    printKeyValue("SHA-256", dim(hash));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printError(`Validation failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  if (options.docker) {
    process.stdout.write("\n");
    printInfo("Running Docker smoke check...");

    const result = await runDockerSmokeCheck({ manifestPath });

    if (result.healthcheckPassed) {
      printSuccess("Docker smoke check passed");
    } else {
      printError(`Docker smoke check failed: ${result.reasonCode ?? "unknown"}`);
      if (result.detail) {
        printInfo(result.detail);
      }
      process.exitCode = 1;
    }
  }
}
