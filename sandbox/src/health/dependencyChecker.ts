import type { ReadinessCheck, ReadinessCheckResult } from "./healthCheckTypes";

interface FsOperations {
  writeFile: (path: string, data: string) => Promise<void>;
  unlink: (path: string) => Promise<void>;
}

export function createRpcCheck(
  rpcUrl: string,
  fetchImpl: typeof fetch = fetch
): ReadinessCheck {
  return {
    name: "rpc",
    check: async (): Promise<ReadinessCheckResult> => {
      const startMs = Date.now();
      try {
        const response = await fetchImpl(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_blockNumber",
            params: []
          })
        });

        const body = (await response.json()) as {
          result?: string;
          error?: { message: string };
        };
        const durationMs = Date.now() - startMs;

        if (body.error) {
          return {
            name: "rpc",
            ok: false,
            message: `RPC error: ${body.error.message}`,
            durationMs
          };
        }

        const blockNumber = parseInt(body.result ?? "0", 16);
        return {
          name: "rpc",
          ok: true,
          message: `block ${blockNumber}`,
          durationMs
        };
      } catch (error) {
        const durationMs = Date.now() - startMs;
        const message = error instanceof Error ? error.message : String(error);
        return {
          name: "rpc",
          ok: false,
          message,
          durationMs
        };
      }
    }
  };
}

export function createAttestationApiCheck(
  apiUrl: string,
  fetchImpl: typeof fetch = fetch
): ReadinessCheck {
  return {
    name: "attestation-api",
    check: async (): Promise<ReadinessCheckResult> => {
      const startMs = Date.now();
      try {
        const response = await fetchImpl(`${apiUrl}/health`, {
          method: "GET"
        });
        const durationMs = Date.now() - startMs;

        if (!response.ok) {
          return {
            name: "attestation-api",
            ok: false,
            message: `attestation API responded with status ${response.status}`,
            durationMs
          };
        }

        return {
          name: "attestation-api",
          ok: true,
          message: "reachable",
          durationMs
        };
      } catch (error) {
        const durationMs = Date.now() - startMs;
        const message = error instanceof Error ? error.message : String(error);
        return {
          name: "attestation-api",
          ok: false,
          message,
          durationMs
        };
      }
    }
  };
}

export function createDiskWritableCheck(
  stateDir: string,
  fs: FsOperations
): ReadinessCheck {
  return {
    name: "disk",
    check: async (): Promise<ReadinessCheckResult> => {
      const startMs = Date.now();
      const probePath = `${stateDir}/.health-probe-${Date.now()}`;
      try {
        await fs.writeFile(probePath, "ok");
        const durationMs = Date.now() - startMs;

        try {
          await fs.unlink(probePath);
        } catch {
          // cleanup failure is non-critical
        }

        return {
          name: "disk",
          ok: true,
          message: "writable",
          durationMs
        };
      } catch (error) {
        const durationMs = Date.now() - startMs;
        const message = error instanceof Error ? error.message : String(error);
        return {
          name: "disk",
          ok: false,
          message,
          durationMs
        };
      }
    }
  };
}
