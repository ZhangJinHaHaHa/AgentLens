/**
 * V1 单合约编译入口：同步读取 `AgentAuditRegistry.sol`，以标准 JSON 接口调用本地 solc，并覆盖写出供部署脚本消费的 Hardhat 风格产物。
 * 固定输入是源码路径、当前安装的 solc 及 Paris/viaIR/优化参数；输出仅含 ABI、创建/运行字节码、编译器版本和解析后的 metadata，不执行部署。
 * 产物定位依赖 sourceName 与 contractName 精确匹配 solc 输出，字节码统一补 `0x`；这些字段是下游 `deployLocal`/`deployEdge` 的兼容契约。
 * 信任边界包括 npm 中的编译器实现与本地源码内容；脚本打印全部编译诊断，并在任一 error 级诊断出现时终止，warning 不阻断写入。
 * 缺少依赖、读取失败、solc 返回非 JSON、目标合约缺失或文件系统写入失败都会中止；写文件不是原子操作，失败后不得把旧产物误认成此次编译结果。
 * 本入口只维护 V1；若需六个手写合约的一致产物应使用 `compileV2.js`，并保持两处编译选项显式对齐。
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
