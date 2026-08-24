/**
 * 外部 Edge 部署的 CLI 边界：从当前进程环境读取并校验 V1 配置，执行一次部署，然后把可机器解析的完整部署元数据写到 stdout。
 * 输入契约是 `EDGE_*` 环境变量；成功输出末尾带换行的 JSON，失败信息写 stderr 并以状态码 1 退出，便于 CI/运维脚本区分数据流与诊断流。
 * 私钥只传入部署层且不应出现在输出；但 RPC 与链 ID 来自运行者配置，命令自身不提供交互确认、重试或幂等键。
 * 抛错可能发生在交易广播之后，非零退出不等价于链上未部署；自动化重试前必须依据日志中的交易上下文或部署账户 nonce 查证链状态。
 * 本文件加载即执行 `main`，应作为进程入口运行而非当作无副作用库导入。
 */
const { deployEdgeRegistry, readEdgeDeploymentConfig } = require("./deployEdge");

async function main() {
  const deployment = await deployEdgeRegistry(readEdgeDeploymentConfig(process.env));
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
