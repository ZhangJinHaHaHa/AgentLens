import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MAX_TEXT_BLOB_BYTES, boundaryPolicyFiles } from "./public-boundary-policy.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const boundaryScript = "scripts/check-public-boundary.mjs";
const historyScript = "scripts/check-public-history.mjs";

function run(command, args, cwd, options = {}) {
  return spawnSync(command, args, { cwd, encoding: "utf8", ...options });
}

function runGit(cwd, ...args) {
  const result = run("git", args, cwd);
  assert.equal(result.status, 0, result.stderr);
}

async function writeFixtureFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

function commitAll(root, message) {
  runGit(root, "add", "--all");
  runGit(root, "commit", "--quiet", "-m", message);
}

async function createFixtureRepository(t, files, { commit = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "agentlens-public-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  runGit(root, "init", "--quiet");
  runGit(root, "config", "user.name", "Public Boundary Test");
  runGit(root, "config", "user.email", "boundary-test@example.invalid");
  await writeFixtureFile(root, "README.md", "https://agentlens.chat/en\n");
  await writeFixtureFile(root, "README_CN.md", "https://agentlens.chat/zh\n");

  for (const policyFile of boundaryPolicyFiles) {
    const content = await readFile(path.join(repositoryRoot, policyFile));
    await writeFixtureFile(root, policyFile, content);
  }
  commitAll(root, "boundary policy baseline");

  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(root, relativePath, content);
  }

  if (commit && Object.keys(files).length > 0) {
    commitAll(root, "test fixture");
  }
  return root;
}

test("公开表面内的 Python 与 Circom 文件可通过两项检查", async (t) => {
  const root = await createFixtureRepository(t, {
    "sandbox/sgx/generate-quote.py": "# documented public example\n",
    "contracts/zk/circuits/AgentFingerprint.circom": "pragma circom 2.1.6;\n"
  }, { commit: true });

  const boundary = run(process.execPath, [boundaryScript], root);
  assert.equal(boundary.status, 0, boundary.stderr);

  const history = run(process.execPath, [historyScript], root);
  assert.equal(history.status, 0, history.stderr);
});

test("当前边界检查会扫描 Python 与 Circom 中的敏感内容", async (t) => {
  // 分段构造测试字符串，避免检查脚本把自测源码本身误认为真实登录信息。
  const syntheticLogin = ["root", "release.example.invalid"].join("@");
  const root = await createFixtureRepository(t, {
    "sandbox/sgx/generate-quote.py": `# ${syntheticLogin}\n`,
    "contracts/zk/circuits/AgentFingerprint.circom": `// ${syntheticLogin}\n`
  });

  const result = run(process.execPath, [boundaryScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /root-login\tcontracts\/zk\/circuits\/AgentFingerprint\.circom/);
  assert.match(result.stderr, /root-login\tsandbox\/sgx\/generate-quote\.py/);
});

test("历史检查会扫描已提交后删除的 Python 与 Circom 恶意 fixture", async (t) => {
  const syntheticLogin = ["root", "history.example.invalid"].join("@");
  const root = await createFixtureRepository(t, {
    "sandbox/sgx/generate-quote.py": `# ${syntheticLogin}\n`,
    "contracts/zk/circuits/AgentFingerprint.circom": `// ${syntheticLogin}\n`
  }, { commit: true });
  await rm(path.join(root, "sandbox/sgx/generate-quote.py"));
  await rm(path.join(root, "contracts/zk/circuits/AgentFingerprint.circom"));
  commitAll(root, "remove adversarial fixture");

  const result = run(process.execPath, [historyScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /root-login\t[0-9a-f]{12}\tcontracts\/zk\/circuits\/AgentFingerprint\.circom/);
  assert.match(result.stderr, /root-login\t[0-9a-f]{12}\tsandbox\/sgx\/generate-quote\.py/);
});

test("未登记源码域即使没有命中敏感词也会默认拒绝", async (t) => {
  const root = await createFixtureRepository(t, {
    "frontend/src/unlisted-area/feature.ts": "export const enabled = true;\n"
  }, { commit: true });

  const boundary = run(process.execPath, [boundaryScript], root);
  assert.equal(boundary.status, 1);
  assert.match(
    boundary.stderr,
    /outside-documented-public-surface\tfrontend\/src\/unlisted-area\/feature\.ts/
  );

  const history = run(process.execPath, [historyScript], root);
  assert.equal(history.status, 1);
  assert.match(
    history.stderr,
    /outside-documented-public-surface\t[0-9a-f]{12}\tfrontend\/src\/unlisted-area\/feature\.ts/
  );
});

test("仅为历史保留的墓碑路径不能在当前工作树中无审阅恢复", async (t) => {
  const root = await createFixtureRepository(t, {
    "docs/popo-icon.png": Buffer.from([0x89, 0x50, 0x4e, 0x47])
  });

  const result = run(process.execPath, [boundaryScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside-documented-public-surface\tdocs\/popo-icon\.png/);
});

test("历史检查不会因重复 blob 的允许路径而漏掉已删除的未登记路径", async (t) => {
  const sharedContent = "export const publicExample = true;\n";
  const allowedPath = "sandbox/src/runtime/runDockerSmokeCheck.ts";
  const unlistedPath = "sandbox/src/runtime/unlisted-copy.ts";
  const root = await createFixtureRepository(t, {
    [allowedPath]: sharedContent,
    [unlistedPath]: sharedContent
  }, { commit: true });
  await rm(path.join(root, unlistedPath));
  commitAll(root, "remove unlisted duplicate");

  const result = run(process.execPath, [historyScript], root);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /outside-documented-public-surface\t[0-9a-f]{12}\tsandbox\/src\/runtime\/unlisted-copy\.ts/
  );
});

test("当前边界同时扫描 staged index 与已恢复干净的工作树", async (t) => {
  const target = "sandbox/src/runtime/runDockerSmokeCheck.ts";
  const cleanContent = "export const publicExample = true;\n";
  const syntheticLogin = ["root", "index.example.invalid"].join("@");
  const root = await createFixtureRepository(t, { [target]: cleanContent }, { commit: true });

  await writeFixtureFile(root, target, `// ${syntheticLogin}\n`);
  runGit(root, "add", target);
  await writeFixtureFile(root, target, cleanContent);

  const result = run(process.execPath, [boundaryScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /root-login\tsandbox\/src\/runtime\/runDockerSmokeCheck\.ts/);
});

test("仅在工作树放宽 allowlist 不能掩盖 index 与历史中的未登记文件", async (t) => {
  const unlistedPath = "frontend/src/pages/policy-split-fixture.ts";
  const allowlistPath = "scripts/public-files.allowlist";
  const root = await createFixtureRepository(t, {});
  await writeFixtureFile(root, unlistedPath, "export const policySplit = true;\n");
  runGit(root, "add", unlistedPath);

  const strictAllowlist = await readFile(path.join(root, allowlistPath), "utf8");
  await writeFixtureFile(root, allowlistPath, `${strictAllowlist.trimEnd()}\n${unlistedPath}\n`);

  const boundary = run(process.execPath, [boundaryScript], root);
  assert.equal(boundary.status, 1);
  assert.match(
    boundary.stderr,
    /boundary-policy-index-divergence\tscripts\/public-files\.allowlist/
  );

  runGit(root, "commit", "--quiet", "-m", "commit staged path only");
  const history = run(process.execPath, [historyScript], root);
  assert.equal(history.status, 1);
  assert.match(
    history.stderr,
    /boundary-policy-index-divergence\t[0-9a-f]{12}\tscripts\/public-files\.allowlist/
  );
});

test("worktree 与 index 一致时允许显式 staged 公开清单升级", async (t) => {
  const newPublicPath = "frontend/src/pages/explicit-public-fixture.ts";
  const allowlistPath = "scripts/public-files.allowlist";
  const root = await createFixtureRepository(t, {});
  await writeFixtureFile(root, newPublicPath, "export const explicitPublicFixture = true;\n");
  const allowlist = await readFile(path.join(root, allowlistPath), "utf8");
  await writeFixtureFile(root, allowlistPath, `${allowlist.trimEnd()}\n${newPublicPath}\n`);
  runGit(root, "add", newPublicPath, allowlistPath);

  const boundary = run(process.execPath, [boundaryScript], root);
  assert.equal(boundary.status, 0, boundary.stderr);

  runGit(root, "commit", "--quiet", "-m", "register explicit public fixture");
  const history = run(process.execPath, [historyScript], root);
  assert.equal(history.status, 0, history.stderr);
});

test("当前与历史检查都拒绝普通文件路径变成符号链接", async (t) => {
  const target = "sandbox/src/runtime/runDockerSmokeCheck.ts";
  const cleanContent = "export const publicExample = true;\n";
  const root = await createFixtureRepository(t, { [target]: cleanContent }, { commit: true });
  const absoluteTarget = path.join(root, target);

  await rm(absoluteTarget);
  await symlink("../../../README.md", absoluteTarget);
  runGit(root, "add", target);

  const linkedWorktree = run(process.execPath, [boundaryScript], root);
  assert.equal(linkedWorktree.status, 1);
  assert.match(linkedWorktree.stderr, /unsafe-file-mode\tsandbox\/src\/runtime\/runDockerSmokeCheck\.ts/);

  await rm(absoluteTarget);
  await writeFixtureFile(root, target, cleanContent);
  const stagedSymlink = run(process.execPath, [boundaryScript], root);
  assert.equal(stagedSymlink.status, 1);
  assert.match(stagedSymlink.stderr, /unsafe-file-mode\tsandbox\/src\/runtime\/runDockerSmokeCheck\.ts/);

  runGit(root, "commit", "--quiet", "-m", "record symlink fixture");
  runGit(root, "add", target);
  runGit(root, "commit", "--quiet", "-m", "restore regular file");

  const history = run(process.execPath, [historyScript], root);
  assert.equal(history.status, 1);
  assert.match(
    history.stderr,
    /unsafe-file-mode\t[0-9a-f]{12}\tsandbox\/src\/runtime\/runDockerSmokeCheck\.ts/
  );
});

test("受管文本超过扫描上限或含 NUL 时默认拒绝", async (t) => {
  const oversized = Buffer.alloc(MAX_TEXT_BLOB_BYTES + 1, 0x61);
  const withNul = Buffer.from("pragma circom 2.1.6;\u0000hidden\n", "utf8");
  const root = await createFixtureRepository(t, {
    "sandbox/sgx/generate-quote.py": oversized,
    "contracts/zk/circuits/AgentFingerprint.circom": withNul
  });

  const result = run(process.execPath, [boundaryScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /oversized-text-blob\tsandbox\/sgx\/generate-quote\.py/);
  assert.match(
    result.stderr,
    /binary-content-in-text-file\tcontracts\/zk\/circuits\/AgentFingerprint\.circom/
  );
});

test("历史检查拒绝后来删除的超限与含 NUL 文本 blob", async (t) => {
  const oversized = Buffer.alloc(MAX_TEXT_BLOB_BYTES + 1, 0x61);
  const withNul = Buffer.from("pragma circom 2.1.6;\u0000hidden\n", "utf8");
  const pythonPath = "sandbox/sgx/generate-quote.py";
  const circomPath = "contracts/zk/circuits/AgentFingerprint.circom";
  const root = await createFixtureRepository(t, {
    [pythonPath]: oversized,
    [circomPath]: withNul
  }, { commit: true });
  await rm(path.join(root, pythonPath));
  await rm(path.join(root, circomPath));
  commitAll(root, "remove invalid text blobs");

  const result = run(process.execPath, [historyScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /oversized-text-blob\t[0-9a-f]{12}\tsandbox\/sgx\/generate-quote\.py/);
  assert.match(
    result.stderr,
    /binary-content-in-text-file\t[0-9a-f]{12}\tcontracts\/zk\/circuits\/AgentFingerprint\.circom/
  );
});

test("仓库现有 webmanifest、template 与 llm 文本格式也接受内容扫描", async (t) => {
  const syntheticLogin = ["root", "format.example.invalid"].join("@");
  const root = await createFixtureRepository(t, {
    "frontend/public/manifest.webmanifest": `${syntheticLogin}\n`,
    "sandbox/sgx/generate-quote.manifest.template": `${syntheticLogin}\n`,
    "sandbox/test-agent/Dockerfile.llm": `${syntheticLogin}\n`
  });

  const result = run(process.execPath, [boundaryScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /root-login\tfrontend\/public\/manifest\.webmanifest/);
  assert.match(result.stderr, /root-login\tsandbox\/sgx\/generate-quote\.manifest\.template/);
  assert.match(result.stderr, /root-login\tsandbox\/test-agent\/Dockerfile\.llm/);
});

test("历史检查拒绝未映射到任何提交树的可达 blob", async (t) => {
  const root = await createFixtureRepository(t, {}, { commit: true });
  const syntheticLogin = ["root", "tagged-blob.example.invalid"].join("@");
  const blob = run("git", ["hash-object", "-w", "--stdin"], root, {
    input: `${syntheticLogin}\n`
  });
  assert.equal(blob.status, 0, blob.stderr);
  const blobOid = blob.stdout.trim();
  runGit(root, "update-ref", "refs/tags/unmapped-fixture", blobOid);

  const result = run(process.execPath, [historyScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unmapped-reachable-blob\t[0-9a-f]{12}\t<unknown>/);
  assert.match(result.stderr, /root-login\t[0-9a-f]{12}\t<unknown>/);
});

test("历史检查扫描提交消息中的敏感内容", async (t) => {
  const target = "sandbox/src/runtime/runDockerSmokeCheck.ts";
  const root = await createFixtureRepository(t, { [target]: "export const revision = 1;\n" }, { commit: true });
  await writeFixtureFile(root, target, "export const revision = 2;\n");
  runGit(root, "add", target);
  const syntheticLogin = ["root", "commit-message.example.invalid"].join("@");
  runGit(root, "commit", "--quiet", "-m", `metadata ${syntheticLogin}`);

  const result = run(process.execPath, [historyScript], root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /root-login\t[0-9a-f]{12}\t<commit-message>/);
});
