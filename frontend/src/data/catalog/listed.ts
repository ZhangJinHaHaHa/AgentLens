import type { AgentCatalogEntry } from "@/domain/catalog";

/**
 * Legacy listed seed agents are intentionally empty.
 *
 * The early public-beta shelf used this file for placeholder cards that had no
 * runnable platform workspace and kept resurfacing after deploys, so the main
 * shelf now only ships curated official entries plus hosted-candidate
 * marketplace agents.
 */
export const listedAgents: AgentCatalogEntry[] = [];
