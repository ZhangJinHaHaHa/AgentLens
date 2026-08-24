/**
 * 该进程入口组装申诉接收服务：解析监听地址、打开持久状态库，并在配置完整时接入链上补偿执行器；不实现 HTTP 路由、审核判定或补偿算法本身。
 * 环境变量是配置与秘密边界，网络请求进入后由 intake server 校验；启动成功只向 stdout 暴露非敏感监听元数据，不回显管理员令牌。
 * 服务会绑定 TCP 端口并读写 stateDir，获批流程还可能触发不可逆链交易；端口非法、文件初始化失败或 listen error 均必须使进程非零结束。
 * 单进程内的并发请求由服务器与持久 store 协调，本入口不提供多实例锁或优雅关停；部署方必须保证共享目录和补偿账户的并发约束。
 */
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
