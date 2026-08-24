/**
 * CommonJS 到 Hardhat ESM 运行时的惰性连接桥：首次调用动态导入 Hardhat，并创建配置中命名为 `hardhat` 的本地网络连接。
 * 无外部参数，输出是可复用的 connection Promise；进程内所有调用共享同一网络实例，保证本地部署器读取的 signer 与 provider 属于同一状态域。
 * 该单例只适用于开发模拟网络，不接收 RPC 或密钥，也不代表持久链连接。缓存的是 Promise 本身，因此首次导入/建网失败后后续调用会重复观察同一拒绝结果。
 * 动态导出的 `default`、`network.create` 以及网络名均依赖当前 Hardhat 主版本接口；升级 Hardhat 或重命名配置网络时必须同步验证此桥接契约。
 */
let connectionPromise;

function getHardhatConnection() {
  connectionPromise ??= import("hardhat").then(({ default: hardhat }) =>
    hardhat.network.create("hardhat")
  );
  return connectionPromise;
}

module.exports = { getHardhatConnection };
