import { Link } from "react-router-dom";

import type { AuditRecord } from "../lib/agentAuditRegistryClient";
import { getAuditStatusLabel } from "../lib/auditStatus";
import { formatTimestamp } from "../lib/format";

interface AuditHistoryListProps {
  tokenId: string;
  records: AuditRecord[];
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<void>;
}

export function AuditHistoryList({
  tokenId,
  records,
  totalCount,
  hasMore,
  isLoadingMore,
  onLoadMore
}: AuditHistoryListProps): JSX.Element {
  return (
    <section className="hero-card">
      <h2>Audit history</h2>
      <ul className="history-list">
        {records.map((record) => {
          const statusLabel = getAuditStatusLabel(record.status);
          const statusClass = `status-badge status-badge--${statusLabel.toLowerCase()}`;

          return (
            <li key={String(record.auditId)} className="history-list-item">
              <div className="history-list-item-header">
                <h3>{`Audit #${String(record.auditId)}`}</h3>
                <span className={statusClass}>{statusLabel}</span>
              </div>
              <div className="history-list-item-details">
                <span>Score: {String(record.auditScore)}</span>
                <span>Time: {formatTimestamp(record.timestamp)}</span>
              </div>
              <div className="history-list-item-metrics">
                <span>{`Memory: ${String(record.memoryPeakMb)} MB`}</span>
                <span>{`CPU: ${String(record.cpuAvgMilli)} mCPU`}</span>
                <span>{`IPs: ${String(record.requestIpCount)}`}</span>
              </div>
              <Link
                to={buildAuditReportHref(tokenId, record, totalCount, records.indexOf(record))}
                className="history-list-item-link"
              >
                View report
              </Link>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <div className="load-more-container">
          <button
            type="button"
            className="load-more-button"
            onClick={() => void onLoadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function buildAuditReportHref(
  tokenId: string,
  record: AuditRecord,
  totalCount: number,
  position: number
): string {
  const auditIndex = totalCount - 1 - position;
  return `/agent/${tokenId}/audits/${String(record.auditId)}/${auditIndex}`;
}
