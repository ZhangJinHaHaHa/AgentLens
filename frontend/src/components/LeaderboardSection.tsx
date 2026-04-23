import { Link } from "react-router-dom";
import type { AgentListEntry } from "./AgentListItem";
import { formatPriceEth } from "../lib/format";

export type LeaderboardCategory = "score" | "reputation" | "popular" | "fresh";

interface LeaderboardSectionProps {
  agents: AgentListEntry[];
  category: LeaderboardCategory;
  onCategoryChange: (cat: LeaderboardCategory) => void;
}

const CATEGORY_OPTIONS: ReadonlyArray<{ value: LeaderboardCategory; label: string; icon: string }> = [
  { value: "score", label: "Top Scored", icon: "🏆" },
  { value: "reputation", label: "Best Reputation", icon: "⭐" },
  { value: "popular", label: "Most Popular", icon: "🔥" },
  { value: "fresh", label: "Recently Audited", icon: "✨" }
];

function getRankedAgents(agents: AgentListEntry[], category: LeaderboardCategory): AgentListEntry[] {
  const copy = [...agents];
  switch (category) {
    case "score":
      return copy
        .filter((a) => a.latestScore !== null)
        .sort((a, b) => Number(b.latestScore) - Number(a.latestScore))
        .slice(0, 10);
    case "reputation":
      return copy
        .filter((a) => a.reputationScore !== null)
        .sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0))
        .slice(0, 10);
    case "popular":
      return copy
        .sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0))
        .slice(0, 10);
    case "fresh":
      return copy
        .filter((a) => a.lastAuditAt > 0)
        .sort((a, b) => b.lastAuditAt - a.lastAuditAt)
        .slice(0, 10);
    default:
      return copy.slice(0, 10);
  }
}

function getMetricDisplay(agent: AgentListEntry, category: LeaderboardCategory): string {
  switch (category) {
    case "score":
      return agent.latestScore !== null ? `Score ${Number(agent.latestScore)}` : "--";
    case "reputation":
      return agent.reputationScore !== null
        ? `Rep ${((agent.reputationScore / 10000) * 100).toFixed(0)}%`
        : "--";
    case "popular":
      return agent.pricing?.configured
        ? `${formatPriceEth(agent.pricing.pricePerDay)}/day`
        : "Not listed";
    case "fresh": {
      if (agent.lastAuditAt <= 0) return "No audits";
      const days = Math.floor((Date.now() / 1000 - agent.lastAuditAt) / 86400);
      return days === 0 ? "Today" : `${days}d ago`;
    }
    default:
      return "--";
  }
}

export function LeaderboardSection({
  agents,
  category,
  onCategoryChange
}: LeaderboardSectionProps): JSX.Element {
  const ranked = getRankedAgents(agents, category);

  return (
    <section className="leaderboard-section hero-card">
      <p className="eyebrow">Leaderboard</p>
      <h2>Top Agents</h2>
      <div className="leaderboard__tabs">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`leaderboard__tab ${category === opt.value ? "leaderboard__tab--active" : ""}`}
            onClick={() => onCategoryChange(opt.value)}
          >
            <span>{opt.icon}</span> {opt.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <p className="intro">No agents available for this ranking yet.</p>
      ) : (
        <ol className="leaderboard__list">
          {ranked.map((agent, idx) => (
            <li key={agent.tokenId} className="leaderboard__item">
              <span className="leaderboard__rank-num">
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
              </span>
              <Link to={`/agent/${agent.tokenId}`} className="leaderboard__agent-link">
                <span className="leaderboard__agent-name">
                  {agent.agentName || `Agent #${agent.tokenId}`}
                </span>
                {agent.riskLevel ? (
                  <span className={`risk-badge ${agent.riskLevel.cssClass} leaderboard__risk`}>
                    {agent.riskLevel.label}
                  </span>
                ) : null}
              </Link>
              <span className="leaderboard__metric">{getMetricDisplay(agent, category)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
