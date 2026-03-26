import { Link } from "react-router-dom";

import type { AuditRecord } from "../lib/agentAuditRegistryClient";
import { getAuditStatusLabel } from "../lib/auditStatus";
import { formatTimestamp } from "../lib/format";
import { AttestationBadge } from "./AttestationBadge";

interface LatestAuditSummaryProps {
  audit: AuditRecord;
  reportHref?: string;
}

export function LatestAuditSummary({ audit, reportHref }: LatestAuditSummaryProps): JSX.Element {
  const statusLabel = getAuditStatusLabel(audit.status);
  const statusClass = `status-badge status-badge--${statusLabel.toLowerCase()}`;

  return (
    <section className="hero-card">
      <h2>Latest audit summary</h2>
      <dl className="detail-grid">
        <div>
          <dt>Audit</dt>
          <dd>{`Audit #${String(audit.auditId)}`}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd><span className={statusClass}>{statusLabel}</span></dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{String(audit.auditScore)}</dd>
        </div>
        <div>
          <dt>TEE attestation</dt>
          <dd>
            <AttestationBadge attestationHash={audit.attestationHash} />
          </dd>
        </div>
        <div>
          <dt>Timestamp</dt>
          <dd>{formatTimestamp(audit.timestamp)}</dd>
        </div>
        <div>
          <dt>Memory peak</dt>
          <dd>{String(audit.memoryPeakMb)} MB</dd>
        </div>
        <div>
          <dt>CPU average</dt>
          <dd>{String(audit.cpuAvgMilli)} mCPU</dd>
        </div>
        <div>
          <dt>Request IP count</dt>
          <dd>{String(audit.requestIpCount)}</dd>
        </div>
      </dl>
      {reportHref ? (
        <Link to={reportHref} className="view-report-link">
          View full report
        </Link>
      ) : null}
    </section>
  );
}
