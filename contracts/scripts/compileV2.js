const fs = require("fs");
const path = require("path");

let solc;

try {
  solc = require("solc");
} catch (error) {
  console.error(
    [
      "Missing Solidity compiler dependency: solc",
      "Run `npm install` inside contracts/ once npm registry access is available."
    ].join("\n")
  );
  process.exit(1);
}

const sourceDir = path.join(__dirname, "..", "src");
const artifactDir = path.join(__dirname, "..", "artifacts");

const CONTRACTS = [
  { name: "AgentAuditRegistry", file: "AgentAuditRegistry.sol" },
  { name: "AgentAuditRegistryV2", file: "AgentAuditRegistryV2.sol" },
  { name: "AgentAuditRegistryV3", file: "AgentAuditRegistryV3.sol" },
  { name: "AgentMarketplace", file: "AgentMarketplace.sol" },
  { name: "AgentReviewRegistry", file: "AgentReviewRegistry.sol" }
];

function formatCompilerVersion(version) {
  const match = /^(\d+\.\d+\.\d+)/.exec(version);
  return match ? match[1] : version;
}

function compileAll() {
  const sources = {};
  for (const contract of CONTRACTS) {
    const sourcePath = path.join(sourceDir, contract.file);
    sources[`src/${contract.file}`] = {
      content: fs.readFileSync(sourcePath, "utf8")
    };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
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
  const fatalErrors = messages.filter((e) => e.severity === "error");

  for (const message of messages) {
    console.error(message.formattedMessage ?? message.message);
  }

  if (fatalErrors.length > 0) {
    process.exit(1);
  }
}

function writeArtifact(output, contractFile, contractName) {
  const contractOutput = output.contracts?.[`src/${contractFile}`]?.[contractName];

  if (!contractOutput) {
    throw new Error(`${contractName} output was not produced`);
  }

  const artifact = {
    contractName,
    sourceName: `src/${contractFile}`,
    abi: contractOutput.abi,
    bytecode: `0x${contractOutput.evm.bytecode.object}`,
    deployedBytecode: `0x${contractOutput.evm.deployedBytecode.object}`,
    compiler: { version: formatCompilerVersion(solc.version()) },
    metadata: JSON.parse(contractOutput.metadata)
  };

  fs.mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `${contractName}.json`);
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Compiled ${contractName} → ${artifactPath}`);
}

function main() {
  const output = compileAll();
  assertNoCompilerErrors(output);

  for (const contract of CONTRACTS) {
    writeArtifact(output, contract.file, contract.name);
  }
}

main();
