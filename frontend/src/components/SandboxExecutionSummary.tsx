import type { DetailedAuditReport } from "../lib/auditReportClient";

interface SandboxExecutionSummaryProps {
  report: DetailedAuditReport;
}

function formatDuration(startedAt: string, finishedAt: string): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  const seconds = Math.max(0, (end - start) / 1000);

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainingSeconds}s`;
}

export function SandboxExecutionSummary({ report }: SandboxExecutionSummaryProps): JSX.Element {
  const duration = formatDuration(
    report.timestamps.startedAt,
    report.timestamps.finishedAt
  );
  const reconciliation = report.responseTrace.reconciliation;

  return (
    <section className="hero-card">
      <h2>Sandbox execution</h2>

      <div className="execution-timeline">
        <div className="execution-timeline-row">
          <span className="execution-timeline-label">Started</span>
          <span className="execution-timeline-value">{report.timestamps.startedAt}</span>
        </div>
        <div className="execution-timeline-row">
          <span className="execution-timeline-label">Finished</span>
          <span className="execution-timeline-value">{report.timestamps.finishedAt}</span>
        </div>
        <div className="execution-timeline-row">
          <span className="execution-timeline-label">Duration</span>
          <span className="execution-timeline-value execution-timeline-duration">{duration}</span>
        </div>
      </div>

      <dl className="detail-grid" style={{ marginTop: 16 }}>
        <div>
          <dt>Healthcheck</dt>
          <dd>
            <span className={report.healthcheckPassed ? "badge-safe" : "badge-danger"}>
              {report.healthcheckPassed ? "Passed" : "Failed"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Decision type</dt>
          <dd>{report.decisionType}</dd>
        </div>
        <div>
          <dt>Reason code</dt>
          <dd>{report.reasonCode ?? "None"}</dd>
        </div>
        <div>
          <dt>CPU average</dt>
          <dd>{report.resourceMetrics.cpuAvgMilli} mCPU</dd>
        </div>
        <div>
          <dt>Memory peak</dt>
          <dd>{report.resourceMetrics.memoryPeakMb} MB</dd>
        </div>
        <div>
          <dt>Request count</dt>
          <dd>{report.networkActivity.requestCount}</dd>
        </div>
        <div>
          <dt>Requested hosts</dt>
          <dd>{report.networkActivity.requestedHosts.join(", ") || "None"}</dd>
        </div>
        <div>
          <dt>Requested IPs</dt>
          <dd>{report.networkActivity.requestedIps.join(", ") || "None"}</dd>
        </div>
      </dl>

      {reconciliation ? (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Action reconciliation</h3>
          <div className="detail-grid">
            <div>
              <dt>Declared hosts</dt>
              <dd>
                {reconciliation.declaredHosts.map((host) => {
                  const observed = reconciliation.observedHosts.includes(host);
                  return (
                    <span key={host} className={observed ? "host-match" : "host-mismatch"}>
                      {host}
                    </span>
                  );
                }).reduce<JSX.Element[]>((acc, el, i) => {
                  if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                  acc.push(el);
                  return acc;
                }, []) || "None"}
              </dd>
            </div>
            <div>
              <dt>Observed hosts</dt>
              <dd>
                {reconciliation.observedHosts.map((host) => {
                  const declared = reconciliation.declaredHosts.includes(host);
                  return (
                    <span key={host} className={declared ? "host-match" : "host-mismatch"}>
                      {host}
                    </span>
                  );
                }).reduce<JSX.Element[]>((acc, el, i) => {
                  if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                  acc.push(el);
                  return acc;
                }, []) || "None"}
              </dd>
            </div>
            {reconciliation.undeclaredObservedHosts.length > 0 ? (
              <div>
                <dt>Undeclared observed</dt>
                <dd>
                  {reconciliation.undeclaredObservedHosts.map((host) => (
                    <span key={host} className="host-mismatch">{host}</span>
                  )).reduce<JSX.Element[]>((acc, el, i) => {
                    if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                    acc.push(el);
                    return acc;
                  }, [])}
                </dd>
              </div>
            ) : null}
            {reconciliation.declaredUnobservedHosts.length > 0 ? (
              <div>
                <dt>Declared unobserved</dt>
                <dd>
                  {reconciliation.declaredUnobservedHosts.map((host) => (
                    <span key={host} className="host-mismatch">{host}</span>
                  )).reduce<JSX.Element[]>((acc, el, i) => {
                    if (i > 0) acc.push(<span key={`sep-${i}`}>, </span>);
                    acc.push(el);
                    return acc;
                  }, [])}
                </dd>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
