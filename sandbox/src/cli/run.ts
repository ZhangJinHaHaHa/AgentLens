/**
 * 本文件是一次性本地沙箱审计的薄进程入口：提取 --manifest、调用标准依赖装配并把最终结果打印为格式化 JSON；不拥有审计阶段或容器清理规则。
 * argv 中的路径/URL 是不可信输入，stdout 是成功结果通道，stderr 与非零 exitCode 表示未被领域结果吸收的配置或基础设施异常。
 * 下游运行会读取文件或网络 manifest、控制 Docker、访问 agent HTTP 端点并采集证据；本层不得提前宣称其中任何边界可信。
 * 每个进程只启动一次审计且等待完整结果；缺少参数必须在产生外部副作用前失败，错误堆栈保留给运维诊断而不改写为伪造结果。
 */
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
