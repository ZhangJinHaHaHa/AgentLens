import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildSmokeConfig,
  findAvailablePort,
  runLocalFrontendSmoke
} from "./runLocalFrontendSmoke.js";

describe("buildSmokeConfig", () => {
  it("uses the local frontend defaults", () => {
    expect(buildSmokeConfig({})).toEqual({
      host: "127.0.0.1",
      bindHost: "127.0.0.1",
      port: 4173,
      tokenId: "1",
      auditId: "1",
      auditIndex: "0",
      agentName: "local-test-agent",
      browserHome: "/tmp/agent-browser-home"
    });
  });

  it("accepts explicit environment overrides", () => {
    expect(
      buildSmokeConfig({
        LOCAL_FRONTEND_SMOKE_HOST: "0.0.0.0",
        LOCAL_FRONTEND_SMOKE_PORT: "5173",
        LOCAL_FRONTEND_SMOKE_TOKEN_ID: "9",
        LOCAL_FRONTEND_SMOKE_AUDIT_ID: "5",
        LOCAL_FRONTEND_SMOKE_AUDIT_INDEX: "4",
        LOCAL_FRONTEND_SMOKE_AGENT_NAME: "sentinel-agent",
        AGENT_BROWSER_HOME: "/tmp/custom-browser-home"
      })
    ).toEqual({
      host: "127.0.0.1",
      bindHost: "0.0.0.0",
      port: 5173,
      tokenId: "9",
      auditId: "5",
      auditIndex: "4",
      agentName: "sentinel-agent",
      browserHome: "/tmp/custom-browser-home"
    });
  });

  it("accepts a dedicated IPv6 browser host override", () => {
    expect(
      buildSmokeConfig({
        LOCAL_FRONTEND_SMOKE_BIND_HOST: "::",
        LOCAL_FRONTEND_SMOKE_BROWSER_HOST: "::1"
      })
    ).toEqual({
      host: "::1",
      bindHost: "::",
      port: 4173,
      tokenId: "1",
      auditId: "1",
      auditIndex: "0",
      agentName: "local-test-agent",
      browserHome: "/tmp/agent-browser-home"
    });
  });
});

describe("runLocalFrontendSmoke", () => {
  it("selects the first available port starting from the requested smoke port", async () => {
    const busyPorts = new Set([4173, 4174]);

    const resolvedPort = await findAvailablePort(4173, async (port) => busyPorts.has(port));

    expect(resolvedPort).toBe(4175);
  });

  it("writes local env, starts vite, and verifies agent/detail pages", async () => {
    const calls = [];

    const summary = await runLocalFrontendSmoke(
      {
        host: "127.0.0.1",
        bindHost: "127.0.0.1",
        port: 4173,
        tokenId: "1",
        auditId: "1",
        auditIndex: "0",
        agentName: "local-test-agent",
        browserHome: "/tmp/agent-browser-home"
      },
      {
        writeFrontendEnvFile: async () => {
          calls.push(["writeFrontendEnvFile"]);
          return "/repo/frontend/.env.local";
        },
        startFrontendDevServer: async (config) => {
          calls.push(["startFrontendDevServer", config.bindHost, config.port]);
          return { pid: 1234 };
        },
        waitForFrontendReady: async (baseUrl) => {
          calls.push(["waitForFrontendReady", baseUrl]);
        },
        runAgentBrowser: async (...args) => {
          calls.push(["runAgentBrowser", ...args]);

          if (args[0] === "get" && args[1] === "url") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://127.0.0.1:4173/agent/1/audits/1/0")) {
              return "http://127.0.0.1:4173/agent/1/audits/1/0";
            }

            return "http://127.0.0.1:4173/agent/1";
          }

          if (args[0] === "get" && args[1] === "text" && args[2] === "body") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://127.0.0.1:4173/agent/1/audits/1/0")) {
              return "Detailed audit report Audit report #1 On-chain summary Hash verified local-test-agent";
            }

            return "Agent 1 Audit history View report";
          }

          return "";
        },
        stopFrontendDevServer: async (server) => {
          calls.push(["stopFrontendDevServer", server.pid]);
        },
        isPortBusy: async () => false
      }
      );

    expect(summary).toEqual({
      envFilePath: "/repo/frontend/.env.local",
      baseUrl: "http://127.0.0.1:4173",
      agentDetailUrl: "http://127.0.0.1:4173/agent/1",
      auditDetailUrl: "http://127.0.0.1:4173/agent/1/audits/1/0"
    });

    expect(calls).toEqual([
      ["writeFrontendEnvFile"],
      ["startFrontendDevServer", "127.0.0.1", 4173],
      ["waitForFrontendReady", "http://127.0.0.1:4173"],
      ["runAgentBrowser", "open", "http://127.0.0.1:4173"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "snapshot", "-i"],
      ["runAgentBrowser", "fill", "e1", "1"],
      ["runAgentBrowser", "click", "e2"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"],
      ["runAgentBrowser", "open", "http://127.0.0.1:4173/agent/1/audits/1/0"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"],
      ["stopFrontendDevServer", 1234]
    ]);
  });

  it("reuses the resolved available port consistently across server start and browser checks", async () => {
    const calls = [];

    const summary = await runLocalFrontendSmoke(
      {
        host: "127.0.0.1",
        bindHost: "127.0.0.1",
        port: 4173,
        tokenId: "1",
        auditId: "1",
        auditIndex: "0",
        agentName: "local-test-agent",
        browserHome: "/tmp/agent-browser-home"
      },
      {
        writeFrontendEnvFile: async () => "/repo/frontend/.env.local",
        startFrontendDevServer: async (config) => {
          calls.push(["startFrontendDevServer", config.bindHost, config.port]);
          return { pid: 1234 };
        },
        waitForFrontendReady: async (baseUrl) => {
          calls.push(["waitForFrontendReady", baseUrl]);
        },
        runAgentBrowser: async (...args) => {
          calls.push(["runAgentBrowser", ...args]);

          if (args[0] === "get" && args[1] === "url") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://127.0.0.1:4174/agent/1/audits/1/0")) {
              return "http://127.0.0.1:4174/agent/1/audits/1/0";
            }

            return "http://127.0.0.1:4174/agent/1";
          }

          if (args[0] === "get" && args[1] === "text" && args[2] === "body") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://127.0.0.1:4174/agent/1/audits/1/0")) {
              return "Detailed audit report Audit report #1 On-chain summary Hash verified local-test-agent";
            }

            return "Agent 1 Audit history View report";
          }

          return "";
        },
        stopFrontendDevServer: async () => {},
        isPortBusy: async (port) => port === 4173
      }
    );

    expect(summary).toEqual({
      envFilePath: "/repo/frontend/.env.local",
      baseUrl: "http://127.0.0.1:4174",
      agentDetailUrl: "http://127.0.0.1:4174/agent/1",
      auditDetailUrl: "http://127.0.0.1:4174/agent/1/audits/1/0"
    });

    expect(calls).toEqual([
      ["startFrontendDevServer", "127.0.0.1", 4174],
      ["waitForFrontendReady", "http://127.0.0.1:4174"],
      ["runAgentBrowser", "open", "http://127.0.0.1:4174"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "snapshot", "-i"],
      ["runAgentBrowser", "fill", "e1", "1"],
      ["runAgentBrowser", "click", "e2"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"],
      ["runAgentBrowser", "open", "http://127.0.0.1:4174/agent/1/audits/1/0"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"]
    ]);
  });

  it("uses a loopback browser host when the dev server binds to 0.0.0.0", async () => {
    const calls = [];

    const summary = await runLocalFrontendSmoke(
      buildSmokeConfig({
        LOCAL_FRONTEND_SMOKE_HOST: "0.0.0.0"
      }),
      {
        writeFrontendEnvFile: async () => "/repo/frontend/.env.local",
        startFrontendDevServer: async (config) => {
          calls.push(["startFrontendDevServer", config.bindHost, config.port]);
          return { pid: 1234 };
        },
        waitForFrontendReady: async (baseUrl) => {
          calls.push(["waitForFrontendReady", baseUrl]);
        },
        runAgentBrowser: async (...args) => {
          calls.push(["runAgentBrowser", ...args]);

          if (args[0] === "get" && args[1] === "url") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://127.0.0.1:4173/agent/1/audits/1/0")) {
              return "http://127.0.0.1:4173/agent/1/audits/1/0";
            }

            return "http://127.0.0.1:4173/agent/1";
          }

          if (args[0] === "get" && args[1] === "text" && args[2] === "body") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://127.0.0.1:4173/agent/1/audits/1/0")) {
              return "Detailed audit report Audit report #1 On-chain summary Hash verified local-test-agent";
            }

            return "Agent 1 Audit history View report";
          }

          return "";
        },
        stopFrontendDevServer: async () => {},
        isPortBusy: async () => false
      }
    );

    expect(summary.baseUrl).toBe("http://127.0.0.1:4173");
    expect(calls).toEqual([
      ["startFrontendDevServer", "0.0.0.0", 4173],
      ["waitForFrontendReady", "http://127.0.0.1:4173"],
      ["runAgentBrowser", "open", "http://127.0.0.1:4173"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "snapshot", "-i"],
      ["runAgentBrowser", "fill", "e1", "1"],
      ["runAgentBrowser", "click", "e2"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"],
      ["runAgentBrowser", "open", "http://127.0.0.1:4173/agent/1/audits/1/0"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"]
    ]);
  });

  it("formats IPv6 browser hosts correctly in smoke URLs", async () => {
    const calls = [];

    const summary = await runLocalFrontendSmoke(
      buildSmokeConfig({
        LOCAL_FRONTEND_SMOKE_BIND_HOST: "::",
        LOCAL_FRONTEND_SMOKE_BROWSER_HOST: "::1"
      }),
      {
        writeFrontendEnvFile: async () => "/repo/frontend/.env.local",
        startFrontendDevServer: async (config) => {
          calls.push(["startFrontendDevServer", config.bindHost, config.port]);
          return { pid: 1234 };
        },
        waitForFrontendReady: async (baseUrl) => {
          calls.push(["waitForFrontendReady", baseUrl]);
        },
        runAgentBrowser: async (...args) => {
          calls.push(["runAgentBrowser", ...args]);

          if (args[0] === "get" && args[1] === "url") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://[::1]:4173/agent/1/audits/1/0")) {
              return "http://[::1]:4173/agent/1/audits/1/0";
            }

            return "http://[::1]:4173/agent/1";
          }

          if (args[0] === "get" && args[1] === "text" && args[2] === "body") {
            if (calls.some((entry) => entry[1] === "open" && entry[2] === "http://[::1]:4173/agent/1/audits/1/0")) {
              return "Detailed audit report Audit report #1 On-chain summary Hash verified local-test-agent";
            }

            return "Agent 1 Audit history View report";
          }

          return "";
        },
        stopFrontendDevServer: async () => {},
        isPortBusy: async () => false
      }
    );

    expect(summary.baseUrl).toBe("http://[::1]:4173");
    expect(calls).toEqual([
      ["startFrontendDevServer", "::", 4173],
      ["waitForFrontendReady", "http://[::1]:4173"],
      ["runAgentBrowser", "open", "http://[::1]:4173"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "snapshot", "-i"],
      ["runAgentBrowser", "fill", "e1", "1"],
      ["runAgentBrowser", "click", "e2"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"],
      ["runAgentBrowser", "open", "http://[::1]:4173/agent/1/audits/1/0"],
      ["runAgentBrowser", "wait", "--load", "networkidle"],
      ["runAgentBrowser", "get", "url"],
      ["runAgentBrowser", "get", "text", "body"]
    ]);
  });

  it("stops the dev server when browser verification fails", async () => {
    const stops = [];

    await expect(
      runLocalFrontendSmoke(
        buildSmokeConfig({}),
        {
          writeFrontendEnvFile: async () => "/repo/frontend/.env.local",
          startFrontendDevServer: async () => ({ pid: 99 }),
          waitForFrontendReady: async () => {},
          runAgentBrowser: async (...args) => {
            if (args[0] === "get" && args[1] === "url") {
              return "http://127.0.0.1:4173/unexpected";
            }

            return "";
          },
          stopFrontendDevServer: async (server) => {
            stops.push(server.pid);
          },
          isPortBusy: async () => false
        }
      )
    ).rejects.toThrow(/expected agent detail url/i);

    expect(stops).toEqual([99]);
  });

  it("does not hang cleanup when the dev server has already exited", async () => {
    let killCalled = false;

    await expect(
      runLocalFrontendSmoke(
        {
          host: "127.0.0.1",
          bindHost: "127.0.0.1",
          port: 4173,
          tokenId: "1",
          auditId: "1",
          auditIndex: "0",
          agentName: "local-test-agent",
          browserHome: "/tmp/agent-browser-home"
        },
        {
          writeFrontendEnvFile: async () => "/repo/frontend/.env.local",
          startFrontendDevServer: async () => ({
            pid: 1234,
            killed: false,
            exitCode: 1,
            signalCode: null,
            once: () => {},
            kill: () => {
              killCalled = true;
              return false;
            }
          }),
          waitForFrontendReady: async () => {
            throw new Error("frontend failed early");
          },
          isPortBusy: async () => false
        }
      )
    ).rejects.toThrow(/frontend failed early/i);

    expect(killCalled).toBe(false);
  });

  it("writes one dedicated smoke summary file when configured", async () => {
    const summaryDir = await fs.mkdtemp(path.join(os.tmpdir(), "frontend-smoke-summary."));
    const summaryFilePath = path.join(summaryDir, "summary.json");
    let openedAuditDetail = false;

    try {
      const summary = await runLocalFrontendSmoke(
        {
          host: "127.0.0.1",
          bindHost: "127.0.0.1",
          port: 4173,
          tokenId: "1",
          auditId: "1",
          auditIndex: "0",
          agentName: "local-test-agent",
          browserHome: "/tmp/agent-browser-home"
        },
        {
          writeFrontendEnvFile: async () => "/repo/frontend/.env.local",
          writeSmokeSummaryFile: async (payload) => {
            await fs.writeFile(summaryFilePath, `${JSON.stringify(payload, null, 2)}\n`);
          },
          startFrontendDevServer: async () => ({ pid: 1234 }),
          waitForFrontendReady: async () => {},
          runAgentBrowser: async (...args) => {
            if (args[0] === "get" && args[1] === "url") {
              if (openedAuditDetail) {
                return "http://127.0.0.1:4173/agent/1/audits/1/0";
              }

              if (args.length === 2) {
                return "http://127.0.0.1:4173/agent/1";
              }
            }

            if (args[0] === "open" && args[1] === "http://127.0.0.1:4173/agent/1/audits/1/0") {
              openedAuditDetail = true;
              return "";
            }

            if (args[0] === "get" && args[1] === "text" && args[2] === "body") {
              if (openedAuditDetail) {
                return "Detailed audit report Audit report #1 On-chain summary Hash verified local-test-agent";
              }

              return "Agent 1 Audit history View report";
            }

            return "";
          },
          stopFrontendDevServer: async () => {},
          isPortBusy: async () => false
        }
      );

      const persisted = JSON.parse(await fs.readFile(summaryFilePath, "utf8"));
      expect(persisted).toEqual(summary);
    } finally {
      await fs.rm(summaryDir, { recursive: true, force: true });
    }
  });
});
