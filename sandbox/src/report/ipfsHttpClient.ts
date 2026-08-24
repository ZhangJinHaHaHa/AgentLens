export interface IpfsHttpClientConfig {
  apiUrl: string;
  authToken?: string;
  // 注入点用于测试或由宿主统一提供网络栈；生产默认值仍是进程级 `fetch`。
  fetchImpl?: typeof fetch;
}

import CID from "cids";

export interface IpfsHttpClient {
  addToIpfs(input: { body: Buffer; fileName: string }): Promise<{ cid: string }>;
}

/**
 * IPFS 服务返回值属于外部信任边界。这里只验证 CID 的语法与多格式兼容性，
 * 不证明该 CID 当前可取回，也不重新计算多哈希来确认它确实对应上传的 `body`；
 * 后两项保证需要由所接入的网关/节点及更高层校验流程承担。
 */
function parseCid(value: unknown): { ok: true } | { ok: false; reason: "missing" | "invalid" } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, reason: "missing" };
  }

  try {
    // cids validates both CIDv0 (Qm...) and CIDv1 (multibase like bafy/zb...).
    new CID(value);
    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/**
 * 创建一个无可变业务状态的上传适配器。认证令牌只会放入发往配置端点的 Bearer 头，
 * 不会进入文件内容或错误消息；`apiUrl` 因此必须来自受信任的部署配置，避免凭据被发送
 * 到非预期主机。每次调用只发起一次 POST，本层不自动重试，重试与去重策略由编排层决定。
 */
export function createIpfsHttpClient(config: IpfsHttpClientConfig): IpfsHttpClient {
  if (!config.apiUrl) {
    throw new Error("apiUrl is required");
  }

  const fetchImpl = config.fetchImpl ?? fetch;

  return {
    async addToIpfs(input: { body: Buffer; fileName: string }): Promise<{ cid: string }> {
      // Buffer 是本地已落盘报告的权威字节；multipart 仅改变传输封装，不重新序列化 JSON。
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(input.body)], { type: "application/json" });
      formData.append("file", blob, input.fileName);

      const headers: Record<string, string> = {};
      if (config.authToken) {
        headers.Authorization = `Bearer ${config.authToken}`;
      }

      const response = await fetchImpl(config.apiUrl, {
        method: "POST",
        headers,
        body: formData
      });

      if (!response.ok) {
        // 不回显上游响应体，避免把网关诊断信息或敏感内容扩散到监听器错误链路。
        throw new Error(`IPFS upload failed with status ${response.status}`);
      }

      // JSON 解析错误直接向上抛出；成功响应仍须经过 CID 解析，不能信任类型断言。
      const payload = (await response.json()) as { cid?: unknown };
      const cidValidation = parseCid(payload.cid);
      if (!cidValidation.ok) {
        if (cidValidation.reason === "missing") {
          throw new Error("cid is missing from IPFS response");
        }
        throw new Error("cid is invalid in IPFS response");
      }

      return { cid: payload.cid as string };
    }
  };
}
