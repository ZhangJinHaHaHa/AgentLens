let connectionPromise;

function getHardhatConnection() {
  connectionPromise ??= import("hardhat").then(({ default: hardhat }) =>
    hardhat.network.create("hardhat")
  );
  return connectionPromise;
}

module.exports = { getHardhatConnection };
