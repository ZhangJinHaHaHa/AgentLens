/**
 * Hardhat 本地部署命令入口：创建/复用进程内模拟网络，发布一份 V1 注册表，并将本次临时链的部署描述以 JSON 输出到 stdout。
 * 该命令不读外部密钥或网络参数，输入由 Hardhat 配置和本地产物隐式提供；stderr 承载异常，任一失败最终转换为退出码 1。
 * 输出地址仅对本进程连接的模拟链有效，不能作为 Edge 或其他持久网络的发布记录；重复运行通常会得到新的网络状态或新合约地址。
 * 部署交易可能已确认而元数据写入/输出随后失败，因此非零退出仍需检查 local 部署文件和当前连接，脚本不自动回滚或重试。
 * 模块在 require 时立即执行，测试或复用业务函数应导入 `deployLocal.js`，而不是导入此 CLI 包装器。
 */
const { deployLocalRegistry } = require("./deployLocal");

async function main() {
  const deployment = await deployLocalRegistry();
  process.stdout.write(`${JSON.stringify(deployment, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
