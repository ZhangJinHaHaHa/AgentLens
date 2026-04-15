import {
  createAppealCompensationExecutor,
  readAppealCompensationConfigFromEnv
} from "../appeal/appealCompensation";
import { createAppealIntakeServer } from "../appeal/appealIntakeServer";
import {
  createPersistentAppealStore,
  resolveAppealStateDirFromEnv
} from "../appeal/persistentAppealStore";

function readPortFromEnv(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error("AUDIT_APPEAL_API_PORT must be a non-negative integer.");
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error("AUDIT_APPEAL_API_PORT must be between 0 and 65535.");
  }

  return port;
}

async function main(): Promise<void> {
  const stateDir = resolveAppealStateDirFromEnv(process.env);
  const store = createPersistentAppealStore({ stateDir });
  const compensationConfig = readAppealCompensationConfigFromEnv(process.env);
  const adminToken = process.env.AUDIT_APPEAL_ADMIN_TOKEN || undefined;
  const server = createAppealIntakeServer({
    store,
    compensateAppeal: compensationConfig
      ? createAppealCompensationExecutor(compensationConfig)
      : undefined,
    adminToken
  });
  const port = readPortFromEnv(process.env.AUDIT_APPEAL_API_PORT);
  const host = process.env.AUDIT_APPEAL_API_HOST || "0.0.0.0";

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve();
    });
  });

  process.stdout.write(
    `${JSON.stringify({ type: "appeal-api-listening", host, port, stateDir, adminTokenConfigured: !!adminToken })}\n`
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
