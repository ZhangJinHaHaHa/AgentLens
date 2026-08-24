/**
 * 本文件把 RPC、证明 API 和状态目录可写性包装为统一 readiness check，供健康端点组合；不负责进程存活判断、告警或依赖恢复。
 * URL、fetch 响应与文件系统都是外部信任边界，输出始终是带名称、布尔状态、说明和耗时的结构化结果，预期故障被吸收而非击穿健康服务器。
 * RPC 检查用 eth_blockNumber 验证协议响应，证明服务要求 /health 返回成功，磁盘检查通过真实创建/删除探针证明当前可写。
 * 各 check 实例无共享状态，可并发调用；磁盘清理失败按既定策略不改变本次 ready 结论，因此运维仍需独立监控残留与磁盘容量。
 */
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
