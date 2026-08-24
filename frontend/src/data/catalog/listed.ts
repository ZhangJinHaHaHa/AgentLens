import type { AgentCatalogEntry } from "@/domain/catalog";

/**
 * Legacy listed seed agents are intentionally empty.
 *
 * The early public-beta shelf used this file for placeholder cards that had no
 * runnable platform workspace and kept resurfacing after deploys, so the main
 * shelf now only ships curated official entries plus hosted-candidate
 * marketplace agents.
 */
/*
 * 空数组本身是兼容契约，而非待前端补齐的加载状态：旧调用方仍可把 listed 分桶传给 mergeCatalog，
 * 但当前公开货架不得重新显示没有可运行工作区的占位卡。若未来恢复该层，条目 id 必须保持跨部署稳定，
 * 输入顺序将直接成为 listed 分桶的展示顺序，并且仍需遵守 AgentCatalogEntry 的双语与来源字段约束。
 * 本文件只保存种子数据，不应在此做远程拉取、可用性探测、去重或排序；空集合应正常产出空分桶，
 * 而不是触发降级数据。恢复非空数据却未同步目录校验、合并优先级和详情展示，才属于兼容性失败。
 */
export const listedAgents: AgentCatalogEntry[] = [];
