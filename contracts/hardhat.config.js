require("@nomiclabs/hardhat-ethers");

module.exports = {
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
  }
};
