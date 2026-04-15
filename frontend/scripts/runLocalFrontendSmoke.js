import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import process from "node:process";

import {
  readPolygonEdgeLocalDeployment,
  writePolygonEdgeLocalEnvFile
} from "./printPolygonEdgeLocalEnv.js";

export function buildSmokeConfig(env = process.env) {
  const bindHost = env.LOCAL_FRONTEND_SMOKE_BIND_HOST || env.LOCAL_FRONTEND_SMOKE_HOST || "127.0.0.1";
  const host = normalizeBrowserHost(
    env.LOCAL_FRONTEND_SMOKE_BROWSER_HOST || env.LOCAL_FRONTEND_SMOKE_HOST || bindHost
  );

  return {
    host,
    bindHost,
    port: Number.parseInt(env.LOCAL_FRONTEND_SMOKE_PORT || "4173", 10),
    tokenId: env.LOCAL_FRONTEND_SMOKE_TOKEN_ID || "1",
    auditId: env.LOCAL_FRONTEND_SMOKE_AUDIT_ID || "1",
    auditIndex: env.LOCAL_FRONTEND_SMOKE_AUDIT_INDEX || "0",
    agentName: env.LOCAL_FRONTEND_SMOKE_AGENT_NAME || "local-test-agent",
    browserHome: env.AGENT_BROWSER_HOME || "/tmp/agent-browser-home"
  };
}

export async function runLocalFrontendSmoke(config = buildSmokeConfig(), dependencies = {}) {
  const {
    writeFrontendEnvFile = async () => writePolygonEdgeLocalEnvFile(readPolygonEdgeLocalDeployment()),
    writeSmokeSummaryFile = defaultWriteSmokeSummaryFile,
    isPortBusy = defaultIsPortBusy,
    startFrontendDevServer = defaultStartFrontendDevServer,
    waitForFrontendReady = defaultWaitForFrontendReady,
    runAgentBrowser = createAgentBrowserRunner(config.browserHome),
    stopFrontendDevServer = defaultStopFrontendDevServer
  } = dependencies;

  const host = normalizeBrowserHost(config.host || "127.0.0.1");
  const bindHost = config.bindHost || config.host || "127.0.0.1";
  const resolvedPort = await findAvailablePort(config.port, async (port) => isPortBusy(port, host));
  const resolvedConfig = {
    ...config,
    host,
    bindHost,
    port: resolvedPort
  };
  const envFilePath = await writeFrontendEnvFile();
  const server = await startFrontendDevServer(resolvedConfig);
  const baseUrl = `http://${formatHostForUrl(resolvedConfig.host)}:${resolvedConfig.port}`;
  const agentDetailUrl = `${baseUrl}/agent/${resolvedConfig.tokenId}`;
  const auditDetailUrl = `${baseUrl}/agent/${resolvedConfig.tokenId}/audits/${resolvedConfig.auditId}/${resolvedConfig.auditIndex}`;

  try {
    await waitForFrontendReady(baseUrl);

    await runAgentBrowser("open", baseUrl);
    await runAgentBrowser("wait", "--load", "networkidle");
    await runAgentBrowser("snapshot", "-i");
    await runAgentBrowser("fill", "e1", resolvedConfig.tokenId);
    await runAgentBrowser("click", "e2");
    await runAgentBrowser("wait", "--load", "networkidle");

    const resolvedAgentDetailUrl = await runAgentBrowser("get", "url");
    if (resolvedAgentDetailUrl !== agentDetailUrl) {
      throw new Error(`Expected agent detail URL ${agentDetailUrl}, received ${resolvedAgentDetailUrl}`);
    }

    const agentDetailText = await runAgentBrowser("get", "text", "body");
    assertIncludes(agentDetailText, "View report", "agent detail page");

    await runAgentBrowser("open", auditDetailUrl);
    await runAgentBrowser("wait", "--load", "networkidle");

    const resolvedAuditDetailUrl = await runAgentBrowser("get", "url");
    if (resolvedAuditDetailUrl !== auditDetailUrl) {
      throw new Error(`Expected audit detail URL ${auditDetailUrl}, received ${resolvedAuditDetailUrl}`);
    }

    const auditDetailText = await runAgentBrowser("get", "text", "body");
    assertIncludes(auditDetailText, `Audit report #${resolvedConfig.auditId}`, "audit detail page");
    assertIncludes(auditDetailText, "On-chain summary", "audit detail page");
    assertIncludes(auditDetailText, "Hash verified", "audit detail page");
    assertIncludes(auditDetailText, resolvedConfig.agentName, "audit detail page");

    const summary = {
      envFilePath,
      baseUrl,
      agentDetailUrl,
      auditDetailUrl
    };

    await writeSmokeSummaryFile(summary);

    return summary;
  } finally {
    await stopFrontendDevServer(server);
  }
}

export async function findAvailablePort(startPort, isPortBusy = defaultIsPortBusy, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidatePort = startPort + offset;
    if (!(await isPortBusy(candidatePort))) {
      return candidatePort;
    }
  }

  throw new Error(`Unable to find an available port starting from ${startPort}`);
}

function assertIncludes(text, expected, context) {
  if (!text.includes(expected)) {
    const normalizedText = text.replace(/\s+/g, " ").trim();
    throw new Error(
      `Expected ${context} to include "${expected}". Received: "${normalizedText.slice(0, 240)}"`
    );
  }
}

function createAgentBrowserRunner(browserHome) {
  return async (...args) => {
    const { execFileSync } = await import("node:child_process");
    return execFileSync("agent-browser", args, {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: browserHome
      }
    }).trim();
  };
}

async function defaultStartFrontendDevServer(config) {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--host", config.bindHost || config.host, "--port", String(config.port), "--strictPort"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    }
  );

  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

async function defaultIsPortBusy(port, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        resolve(false);
        return;
      }

      reject(error);
    });
  });
}

function normalizeBrowserHost(host) {
  if (host === "0.0.0.0" || host === "::" || host === "[::]") {
    return "127.0.0.1";
  }

  if (host.startsWith("[") && host.endsWith("]")) {
    return host.slice(1, -1);
  }

  return host;
}

function formatHostForUrl(host) {
  if (host.includes(":")) {
    return `[${host}]`;
  }

  return host;
}

async function defaultWaitForFrontendReady(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling until the dev server is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for frontend readiness at ${baseUrl}`);
}

async function defaultStopFrontendDevServer(server) {
  if (!server || typeof server.kill !== "function") {
    return;
  }

  if (server.killed || server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    if (typeof server.once !== "function") {
      resolve();
      return;
    }

    const handleExit = () => resolve();
    server.once("exit", handleExit);

    if (server.kill("SIGTERM")) {
      return;
    }

    if (typeof server.off === "function") {
      server.off("exit", handleExit);
    }
    resolve();
  });
}

async function defaultWriteSmokeSummaryFile(summary) {
  const outputPath = process.env.LOCAL_FRONTEND_SMOKE_SUMMARY_FILE;
  if (!outputPath) {
    return;
  }

  await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await runLocalFrontendSmoke();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
