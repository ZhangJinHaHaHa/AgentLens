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
