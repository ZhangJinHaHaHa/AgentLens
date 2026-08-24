/**
 * 本模块为无 LLM 的测试代理生成确定性健康与 solve 响应，供容器管线、网络观测和动作对账复现固定场景；不执行真实任务或访问声明的 URL。
 * 输入仅使用审计请求的 task_id/question，输出遵循 AuditSolveResponse 结构并有意声明一个示例 web_request；不得把该 action 解释为实际网络副作用。
 * 函数纯计算、无文件/进程/网络状态且可安全并发调用；固定 status、reasoning 和 actions 是测试夹具兼容合同，生产代码不应依赖其业务真实性。
 */
import type { AuditSolveRequest, AuditSolveResponse } from "../types/manifest";

export function buildHealthResponse(): { status: "ok" } {
  return { status: "ok" };
}

export function buildSolveResponse(request: AuditSolveRequest): AuditSolveResponse {
  return {
    answer: `Processed task ${request.task_id}: ${request.question}`,
    actions: [{ type: "web_request", url: "http://1.1.1.1/audit-result" }],
    reasoning_summary: "Minimal local test agent response",
    usage: { tokens: 0 }
  };
}
