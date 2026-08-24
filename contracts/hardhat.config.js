/**
 * Hardhat 工程入口：固定本目录手写合约的编译器、优化策略、源码/测试/产物位置，并注册 ethers 与 Mocha 插件。
 * 输入来自本文件声明及已安装的插件/solc 版本；Hardhat 命令据此读取 `src`，向 `artifacts`、`cache` 写入派生产物并执行 `tests`。
 * `0.8.24 + optimizer(200) + viaIR` 共同参与字节码与元数据生成，是部署可复现性的组成部分；改变任一项都应视为产物兼容性变更。
 * 这里只声明 EDR 模拟的 L1 `hardhat` 网络，不承载生产 RPC、链 ID 或签名密钥；外部链部署的信任边界位于 `scripts/deploy*.js`。
 * 配置加载会在插件缺失、Hardhat API 不兼容或编译器不可取得时失败；本配置也不保证与两个手写 solc 编译脚本的独立设置自动同步。
 */
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatEthers, hardhatMocha],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  paths: {
    sources: "./src",
    tests: "./tests",
    artifacts: "./artifacts",
    cache: "./cache"
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1"
    }
  }
});
