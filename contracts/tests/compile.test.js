const assert = require("assert");
const fs = require("fs");
const path = require("path");

describe("compile output", function () {
  it("writes the AgentAuditRegistry artifact with ABI and bytecode", function () {
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "AgentAuditRegistry.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    assert.ok(Array.isArray(artifact.abi), "abi must be present");
    assert.ok(
      artifact.abi.some((entry) => entry.type === "function" && entry.name === "stake"),
      "stake ABI entry must exist"
    );
    assert.ok(
      artifact.abi.some(
        (entry) => entry.type === "function" && entry.name === "recordAuditResult"
      ),
      "recordAuditResult ABI entry must exist"
    );
    assert.match(artifact.bytecode, /^0x[0-9a-f]+$/i);
    assert.ok(artifact.bytecode.length > 2, "bytecode must not be empty");
    assert.strictEqual(artifact.compiler.version, "0.8.24");
    assert.strictEqual(
      artifact.metadata.settings.evmVersion,
      "paris",
      "artifact must target a Polygon Edge compatible EVM version"
    );
  });
});
