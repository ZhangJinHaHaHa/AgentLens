import type { OnboardingGuide } from "@/domain/onboarding";

/*
 * 这份指南对应 AgentLens 托管的 DocsGPT 兼容“临时资料问答”入口：官方仓库与文档提供产品参考，
 * 平台实际输出则是基于用户主动上传文本的答案、来源、文件引用和积分记录。
 * docsgpt 是精选目录、工作区路由和指南注册的稳定连接键；它不能因底层 runner 更换而改名。
 * 操作顺序先收文件、再提出具体问题、最后核对证据，详情页按此编号展示，不能把核验步骤前置成
 * 已经存在的事实。此文件不解析 PDF、不做 OCR、不保留长期向量库，也不接入网盘/邮箱权限。
 * 无法提取文字、来源对不上或托管适配器不可用时必须返回明确失败/证据不足；指南存在并不代表
 * 完整 DocsGPT 管理后台或企业知识库已经接通。
 */
export const guide: OnboardingGuide = {
  agentId: "docsgpt",
  prerequisites: [
    {
      zh: "准备一份可读取文字的资料，例如 Markdown、文本、会议记录或已提取文字的 PDF 内容。",
      en: "Prepare text-readable material such as Markdown, plain text, meeting notes, or PDF content with extractable text."
    },
    {
      zh: "确认目标是围绕资料做问答、摘要或依据提取，不是长期企业知识库管理。",
      en: "Confirm the goal is Q&A, summarisation, or evidence extraction over the material, not long-lived enterprise knowledge-base administration."
    }
  ],
  firstStep: {
    zh: "在平台工作区打开 DocsGPT，上传一份资料，然后问“这份资料最重要的三条结论是什么？”。",
    en: "Open DocsGPT in the platform workspace, upload a document, then ask: “What are the three most important conclusions in this material?”"
  },
  steps: [
    {
      title: { zh: "上传或粘贴资料", en: "Upload or paste material" },
      body: {
        zh: "首版优先处理文本、Markdown 和可提取文字的资料。扫描件、复杂图片和长期知识库会在后续扩展。",
        en: "The first version prioritises text, Markdown, and extractable document text. Scans, complex images, and persistent knowledge bases come later."
      }
    },
    {
      title: { zh: "问一个具体问题", en: "Ask a concrete question" },
      body: {
        zh: "问题越具体越好，例如“这份合同里付款节点是什么”“列出三条风险”“帮我做成行动清单”。",
        en: "The more concrete the question, the better: “What are the payment milestones?”, “List three risks”, or “Turn this into an action list”."
      }
    },
    {
      title: { zh: "检查来源和运行记录", en: "Check sources and run records" },
      body: {
        zh: "结果返回后看来源、文件引用和积分记录，确认答案确实来自你上传的资料。",
        en: "After the answer returns, review sources, file references, and credit records to confirm the answer came from the uploaded material."
      }
    }
  ],
  officialDocs: [
    {
      label: { zh: "DocsGPT GitHub", en: "DocsGPT GitHub" },
      url: "https://github.com/arc53/DocsGPT"
    },
    {
      label: { zh: "DocsGPT 文档", en: "DocsGPT docs" },
      url: "https://docs.docsgpt.cloud"
    }
  ],
  platformAdvice: {
    zh: "AgentLens 建议：把 DocsGPT 当成“临时资料问答助手”先跑通，等文件解析、OCR、权限和留存策略稳定后，再升级为长期知识库。",
    en: "AgentLens advice: treat DocsGPT as a temporary document Q&A assistant first. Upgrade to persistent knowledge bases after file parsing, OCR, permissions, and retention policies are stable."
  },
  commonPitfalls: [
    {
      zh: "上传的是扫描图片或不可提取文字的 PDF，却期待它像完整 OCR 系统一样准确。",
      en: "Uploading scanned images or non-extractable PDFs while expecting full OCR accuracy."
    },
    {
      zh: "把临时文件问答说成已经接入企业知识库、网盘或邮箱。",
      en: "Presenting temporary file Q&A as if enterprise knowledge bases, drives, or email are already connected."
    }
  ]
};
