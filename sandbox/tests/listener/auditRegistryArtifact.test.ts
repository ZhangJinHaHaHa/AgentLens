import test from "node:test";
import assert from "node:assert/strict";

import {
  getAuditRegistryArtifact,
  getAuditRegistryInterface,
  getSlashBondEntry
} from "../../src/listener/auditRegistryArtifact";

test("getAuditRegistryArtifact loads the compiled contract artifact from contracts/", () => {
  const artifact = getAuditRegistryArtifact();

  assert.equal(artifact.contractName, "AgentAuditRegistry");
  assert.equal(artifact.sourceName, "src/AgentAuditRegistry.sol");
  assert.ok(Array.isArray(artifact.abi));
  assert.ok(
    artifact.abi.some((entry) => entry.type === "function" && entry.name === "recordAuditResult")
  );
});

test("getAuditRegistryInterface exposes the compiled recordAuditResult ABI", () => {
  const contractInterface = getAuditRegistryInterface();
  const fragment = contractInterface.getFunction("recordAuditResult");

  assert.equal(fragment.name, "recordAuditResult");
  assert.deepEqual(
    fragment.inputs.map((input) => input.type),
    [
      "uint256",
      "uint32",
      "uint32",
      "uint32",
      "uint32",
      "uint8",
      "bytes32",
      "bytes32",
      "bytes32",
      "bytes32",
      "string",
      "string",
      "string"
    ]
  );
});

test("getSlashBondEntry exposes the compiled slashBond ABI fragment", () => {
  const entry = getSlashBondEntry();

  assert.equal(entry.name, "slashBond");
  assert.deepEqual(
    entry.inputs.map((input) => input.type),
    ["uint256", "uint64", "uint256", "bytes32"]
  );
});
