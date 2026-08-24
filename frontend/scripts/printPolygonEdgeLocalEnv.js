import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 该脚本把 Polygon Edge 本地部署产物转换成 Vite 可消费的环境变量文本；输入来自部署 JSON 或显式路径，
// 输出默认写到 stdout，只有 --write 才覆盖 frontend/.env.local。它不部署合约，也不验证链是否可达。
// 部署元数据被视为本地联调输入而非秘密存储；调用方必须保证地址、链 ID 与 RPC URL 属于预期网络。
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

  // 在隔离 worktree 中运行时兼容读取主工作树生成的部署产物；显式 CLI 路径始终优先且不触发此回退。
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
  // 写入是有意的全量替换，以避免保留上一次链配置；函数不做备份，失败恢复应由调用方重建该派生文件。
  const outputPath = path.join(frontendDirectory, ".env.local");
  fsImpl.writeFileSync(outputPath, `${formatPolygonEdgeLocalEnv(deployment, env)}\n`);
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  // 直接执行时才产生 I/O；被 smoke 脚本导入时仅暴露可注入、可测试的转换与读取函数。
  const deployment = readPolygonEdgeLocalDeployment();

  if (process.argv.includes("--write")) {
    process.stdout.write(`${writePolygonEdgeLocalEnvFile(deployment)}\n`);
  } else {
    process.stdout.write(`${formatPolygonEdgeLocalEnv(deployment)}\n`);
  }
}
