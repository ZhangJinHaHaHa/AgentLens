/**
 * 多合约发布编译器：一次装载注册表 V1/V2/V3、市场、评价与 ZK 证明登记器六个手写源码，再为清单中的每个主合约分别落盘产物。
 * 输入清单同时定义 solc 的 source key 和期望 contractName；输出为 `artifacts/<contractName>.json`，后续各版本部署器按该稳定命名查找 ABI 与字节码。
 * 所有源码共享同一次 Paris/viaIR/optimizer(200) 编译，避免跨文件设置漂移；自动生成的 Groth16 verifier 不在此清单内，也不会被该脚本更新。
 * 本地 solc 与文件系统属于构建信任边界，生成的 ABI/字节码在部署前仍需与目标链和预期源码校验；该脚本本身不连接 RPC 或签名交易。
 * 编译 error 会在任何产物写入前退出；但逐个产物写入并非事务，后段写入异常时目录中可能同时存在新旧文件，调用方应按整批结果处理。
 * source key、合约名、编译器主次补丁版本提取方式均是现有消费者的兼容约束，新增或重命名合约必须同步维护清单与部署脚本。
 */
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
  { name: "AgentReviewRegistry", file: "AgentReviewRegistry.sol" },
  { name: "ZkAuditVerifier", file: "ZkAuditVerifier.sol" }
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
