const fs = require("fs");
const path = require("path");

let solc;

try {
  solc = require("solc");
} catch (error) {
  console.error(
    [
      "Missing Solidity compiler dependency: solc",
      "Run `npm install` inside contracts/ once npm registry access is available.",
      "This repository currently cannot resolve the configured npm registry from this environment."
    ].join("\n")
  );
  process.exit(1);
}

const sourcePath = path.join(__dirname, "..", "src", "AgentAuditRegistry.sol");
const artifactDir = path.join(__dirname, "..", "artifacts");
const artifactPath = path.join(artifactDir, "AgentAuditRegistry.json");

function formatCompilerVersion(version) {
  const match = /^(\d+\.\d+\.\d+)/.exec(version);
  return match ? match[1] : version;
}

function readSource() {
  return fs.readFileSync(sourcePath, "utf8");
}

function compileContract(source) {
  const input = {
    language: "Solidity",
    sources: {
      "src/AgentAuditRegistry.sol": {
        content: source
      }
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris",
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"]
        }
      }
    }
  };

  return JSON.parse(solc.compile(JSON.stringify(input)));
}

function assertNoCompilerErrors(output) {
  const messages = output.errors ?? [];
  const fatalErrors = messages.filter((entry) => entry.severity === "error");

  if (messages.length > 0) {
    for (const message of messages) {
      const line = message.formattedMessage ?? message.message;
      console.error(line);
    }
  }

  if (fatalErrors.length > 0) {
    process.exit(1);
  }
}

function buildArtifact(output) {
  const contractOutput =
    output.contracts?.["src/AgentAuditRegistry.sol"]?.AgentAuditRegistry;

  if (!contractOutput) {
    throw new Error("AgentAuditRegistry output was not produced");
  }

  return {
    contractName: "AgentAuditRegistry",
    sourceName: "src/AgentAuditRegistry.sol",
    abi: contractOutput.abi,
    bytecode: `0x${contractOutput.evm.bytecode.object}`,
    deployedBytecode: `0x${contractOutput.evm.deployedBytecode.object}`,
    compiler: {
      version: formatCompilerVersion(solc.version())
    },
    metadata: JSON.parse(contractOutput.metadata)
  };
}

function writeArtifact(artifact) {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
}

function main() {
  const source = readSource();
  const output = compileContract(source);

  assertNoCompilerErrors(output);
  writeArtifact(buildArtifact(output));
}

main();
