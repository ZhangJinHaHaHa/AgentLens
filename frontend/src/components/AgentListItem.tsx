import { Link } from "react-router-dom";

import { getAuditStatusLabel } from "../lib/auditStatus";
import { truncateAddress } from "../lib/format";

export interface AgentListEntry {
  tokenId: string;
  agentName: string;
  developer: string;
  latestStatus: bigint | number | null;
  latestScore: bigint | number | null;
  auditCount: bigint | number;
}

interface AgentListItemProps {
  agent: AgentListEntry;
}

export function AgentListItem({ agent }: AgentListItemProps): JSX.Element {
  const statusLabel =
    agent.latestStatus !== null ? getAuditStatusLabel(agent.latestStatus) : "No audits";
  const scoreLabel =
    agent.latestScore !== null ? String(Number(agent.latestScore)) : "--";
  const statusClass = agent.latestStatus !== null
    ? `status-badge status-badge--${statusLabel.toLowerCase()}`
    : "status-badge status-badge--none";

  return (
    <li className="agent-list-item">
      <Link to={`/agent/${agent.tokenId}`} className="agent-list-item-link">
        <div className="agent-list-item-header">
          <h3 className="agent-list-item-name">{agent.agentName || `Agent #${agent.tokenId}`}</h3>
          <span className={statusClass}>{statusLabel}</span>
        </div>
        <div className="agent-list-item-details">
          <span className="agent-list-item-detail">
            Token #{agent.tokenId}
          </span>
          <span className="agent-list-item-detail">
            {truncateAddress(agent.developer)}
          </span>
          <span className="agent-list-item-detail">
            Score: {scoreLabel}
          </span>
          <span className="agent-list-item-detail">
            Audits: {String(Number(agent.auditCount))}
          </span>
        </div>
      </Link>
    </li>
  );
}
