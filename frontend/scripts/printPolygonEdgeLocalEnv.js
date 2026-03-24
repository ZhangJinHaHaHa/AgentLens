import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const DEFAULT_DEPLOYMENT_RELATIVE_PATH = path.join(
  "contracts",
  "deployments",
  "polygon-edge-local",
  "AgentAuditRegistry.json"
);

export function formatPolygonEdgeLocalEnv(deployment, env = process.env) {
  const lines = [
    `VITE_AUDIT_RPC_URL=${deployment.rpcUrl}`,
    `VITE_AUDIT_REGISTRY_ADDRESS=${deployment.address}`,
    `VITE_AUDIT_CHAIN_ID=${deployment.chainId}`
  ];

  if (env.VITE_AUDIT_REPORT_GATEWAY_URL) {
    lines.push(`VITE_AUDIT_REPORT_GATEWAY_URL=${env.VITE_AUDIT_REPORT_GATEWAY_URL}`);
  }

  return lines.join("\n");
}

export function buildDeploymentPathCandidates(scriptFilePath = __filename) {
  const scriptDirectory = path.dirname(scriptFilePath);
  const worktreeRoot = path.resolve(scriptDirectory, "../..");
  const candidates = [path.join(worktreeRoot, DEFAULT_DEPLOYMENT_RELATIVE_PATH)];
  const worktreesSegment = `${path.sep}.worktrees${path.sep}`;
  const segmentIndex = worktreeRoot.indexOf(worktreesSegment);

  if (segmentIndex >= 0) {
    candidates.push(path.join(worktreeRoot.slice(0, segmentIndex), DEFAULT_DEPLOYMENT_RELATIVE_PATH));
  }

  return candidates;
}

export function readPolygonEdgeLocalDeployment(
  deploymentPath = resolveDeploymentPathArg(process.argv),
  fsImpl = fs,
  scriptFilePath = __filename
) {
  const candidates = deploymentPath
    ? [path.resolve(deploymentPath)]
    : buildDeploymentPathCandidates(scriptFilePath);

  for (const candidate of candidates) {
    if (fsImpl.existsSync(candidate)) {
      return JSON.parse(fsImpl.readFileSync(candidate, "utf8"));
    }
  }

  throw new Error(
    `Polygon Edge local deployment metadata was not found. Checked: ${candidates.join(", ")}`
  );
}

export function resolveDeploymentPathArg(argv = process.argv) {
  const candidate = argv[2];
  if (!candidate || candidate.startsWith("--")) {
    return undefined;
  }

  return candidate;
}

export function writePolygonEdgeLocalEnvFile(
  deployment,
  fsImpl = fs,
  frontendDirectory = path.resolve(path.dirname(__filename), ".."),
  env = process.env
) {
  const outputPath = path.join(frontendDirectory, ".env.local");
  fsImpl.writeFileSync(outputPath, `${formatPolygonEdgeLocalEnv(deployment, env)}\n`);
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const deployment = readPolygonEdgeLocalDeployment();

  if (process.argv.includes("--write")) {
    process.stdout.write(`${writePolygonEdgeLocalEnvFile(deployment)}\n`);
  } else {
    process.stdout.write(`${formatPolygonEdgeLocalEnv(deployment)}\n`);
  }
}
