import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

// A 线 smoke 通过真实 Vite 进程验证关键公开路由都回落到同一 SPA 壳；
// 它不执行浏览器交互、链上读取或页面业务断言，因此通过只证明路由 HTTP 可达与入口完整。
// 输入由环境变量提供监听/访问地址和起始端口，成功输出可机读摘要，任何路由或进程错误均令命令失败。
const A_FLOW_ROUTES = [
  "/zh/agents",
  "/zh/compare?ids=claude-code,cursor,aider,v0,extra",
  "/zh/recommend",
  "/zh/agent/claude-code",
  "/zh/agent/claude-code/audits/latest/0"
];

export function buildAFlowSmokeConfig(env = process.env) {
  const bindHost = env.A_FLOW_SMOKE_BIND_HOST || env.A_FLOW_SMOKE_HOST || "127.0.0.1";
  const host = normalizeBrowserHost(env.A_FLOW_SMOKE_BROWSER_HOST || env.A_FLOW_SMOKE_HOST || bindHost);

  return {
    host,
    bindHost,
    port: Number.parseInt(env.A_FLOW_SMOKE_PORT || "5175", 10),
    browserHome: env.A_FLOW_SMOKE_BROWSER_HOME || env.AGENT_BROWSER_HOME || "/tmp/agentlens-a-flow-browser-home"
  };
}

export async function runAFlowSmoke(config = buildAFlowSmokeConfig(), dependencies = {}) {
  const {
    isPortBusy = defaultIsPortBusy,
    startFrontendDevServer = defaultStartFrontendDevServer,
    waitForFrontendReady = defaultWaitForFrontendReady,
    fetchRoute = defaultFetchRoute,
    stopFrontendDevServer = defaultStopFrontendDevServer
  } = dependencies;

  const host = normalizeBrowserHost(config.host || "127.0.0.1");
  const bindHost = config.bindHost || config.host || "127.0.0.1";
  const port = await findAvailablePort(config.port, async (candidatePort) => isPortBusy(candidatePort, host));
  const resolvedConfig = { ...config, host, bindHost, port };
  const server = await startFrontendDevServer(resolvedConfig);
  const baseUrl = `http://${formatHostForUrl(host)}:${port}`;

  // 服务启动后的所有断言都置于 finally 保护内；无论就绪超时还是某一路由失败，都尝试回收子进程。
  try {
    await waitForFrontendReady(baseUrl);

    const checkedRoutes = [];
    for (const route of A_FLOW_ROUTES) {
      const html = await fetchRoute(`${baseUrl}${route}`);
      assertSpaShell(html, route);
      checkedRoutes.push(route);
    }

    return {
      mode: "route-http",
      baseUrl,
      routes: checkedRoutes
    };
  } finally {
    await stopFrontendDevServer(server);
  }
}

export async function findAvailablePort(startPort, isPortBusy = defaultIsPortBusy, maxAttempts = 20) {
  // 有界向后探测避免与并行任务争用默认端口；耗尽窗口时显式失败，不随机选择不可复现的端口。
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidatePort = startPort + offset;
    if (!(await isPortBusy(candidatePort))) {
      return candidatePort;
    }
  }

  throw new Error(`Unable to find an available port starting from ${startPort}`);
}

function assertSpaShell(html, route) {
  if (!html.includes('id="root"') || !html.includes("/src/main.tsx")) {
    throw new Error(`Route ${route} did not return the Vite SPA shell.`);
  }
}

async function defaultFetchRoute(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`Expected ${url} to return 2xx. Received ${response.status}.`);
  }

  return response.text();
}

async function defaultWaitForFrontendReady(baseUrl) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(baseUrl, {
        headers: {
          Accept: "text/html"
        }
      });
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling until Vite is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for frontend readiness at ${baseUrl}`);
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
  // 通配监听地址不能作为浏览器目的地址；保留独立 bindHost，同时将访问端规范到本机回环。
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await runAFlowSmoke();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
