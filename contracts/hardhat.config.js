require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: {
    version: "0.8.24"
  },
  paths: {
    sources: "./src",
    tests: "./tests",
    artifacts: "./artifacts",
    cache: "./cache"
  }
};
