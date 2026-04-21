import { Link } from "react-router-dom";

import type { AgentListEntry } from "./AgentListItem";
import { getAuditStatusLabel } from "../lib/auditStatus";
import { truncateAddress, formatPriceEth } from "../lib/format";
import { getAuditFreshness } from "../lib/riskLevel";

interface EnhancedAgentCardProps {
  agent: AgentListEntry;
}

export function EnhancedAgentCard({ agent }: EnhancedAgentCardProps): JSX.Element {
  const statusLabel =
    agent.latestStatus !== null ? getAuditStatusLabel(agent.latestStatus) : "No audits";
  const statusClass = agent.latestStatus !== null
    ? `status-badge status-badge--${statusLabel.toLowerCase()}`
    : "status-badge status-badge--none";
  const scoreLabel =
    agent.latestScore !== null ? String(Number(agent.latestScore)) : "--";
  const freshness = getAuditFreshness(agent.lastAuditAt);

  return (
    <li className="enhanced-agent-card">
      <Link to={`/agent/${agent.tokenId}`} className="enhanced-agent-card__link">
        <div className="enhanced-agent-card__header">
          <div className="enhanced-agent-card__title-row">
            <h3 className="enhanced-agent-card__name">
              {agent.agentName || `Agent #${agent.tokenId}`}
            </h3>
            <span className={statusClass}>{statusLabel}</span>
          </div>
          {agent.riskLevel ? (
            <span className={`risk-badge ${agent.riskLevel.cssClass}`}>
              {agent.riskLevel.label}
            </span>
          ) : null}
        </div>

        <div className="enhanced-agent-card__meta">
          <span className="enhanced-agent-card__detail">
            Token #{agent.tokenId}
          </span>
          <span className="enhanced-agent-card__detail">
            {truncateAddress(agent.developer)}
          </span>
          {agent.attestationVerified ? (
            <span className="attestation-inline attestation-inline--verified">
              TEE Verified
            </span>
          ) : null}
        </div>

        <div className="enhanced-agent-card__metrics">
          <div className="enhanced-agent-card__metric">
            <span className="enhanced-agent-card__metric-value">{scoreLabel}</span>
            <span className="enhanced-agent-card__metric-label">Score</span>
          </div>
          <div className="enhanced-agent-card__metric">
            <span className="enhanced-agent-card__metric-value">
              {String(Number(agent.auditCount))}
            </span>
            <span className="enhanced-agent-card__metric-label">Audits</span>
          </div>
          {agent.reputationScore !== null ? (
            <div className="enhanced-agent-card__metric">
              <span className="enhanced-agent-card__metric-value">
                {((agent.reputationScore / 10000) * 100).toFixed(0)}%
              </span>
              <span className="enhanced-agent-card__metric-label">Reputation</span>
            </div>
          ) : null}
          {agent.pricing?.configured ? (
            <div className="enhanced-agent-card__metric">
              <span className="enhanced-agent-card__metric-value price-chip">
                {formatPriceEth(agent.pricing.pricePerDay)}/day
              </span>
              <span className="enhanced-agent-card__metric-label">Rental</span>
            </div>
          ) : null}
          <div className="enhanced-agent-card__metric">
            <span className={`freshness-badge ${freshness.cssClass}`}>
              {freshness.label}
            </span>
            <span className="enhanced-agent-card__metric-label">Last Audit</span>
          </div>
        </div>
      </Link>
    </li>
  );
}
