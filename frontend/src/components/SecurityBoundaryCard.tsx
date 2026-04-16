import type { SecurityBoundaryMeta } from "../lib/auditReportClient";

interface SecurityBoundaryCardProps {
  boundary: SecurityBoundaryMeta;
}

function getScoreColor(score: number): string {
  if (score > 70) return "boundary-score--safe";
  if (score >= 40) return "boundary-score--warn";
  return "boundary-score--danger";
}

export function SecurityBoundaryCard({ boundary }: SecurityBoundaryCardProps): JSX.Element {
  const scoreClass = getScoreColor(boundary.score);

  return (
    <section className="hero-card">
      <h2>Security boundary assessment</h2>
      <div className="boundary-summary">
        <div className={`boundary-score ${scoreClass}`}>
          <span className="boundary-score-value">{boundary.score}</span>
          <span className="boundary-score-label">/ 100</span>
        </div>
        <dl className="detail-grid" style={{ flex: 1 }}>
          <div>
            <dt>Authorization boundary</dt>
            <dd>
              <span className={boundary.hasAuthBoundary ? "badge-safe" : "badge-danger"}>
                {boundary.hasAuthBoundary ? "Defined" : "Not defined"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Privilege escalation resistance</dt>
            <dd>
              <span className={boundary.privilegeEscalationResistant ? "badge-safe" : "badge-danger"}>
                {boundary.privilegeEscalationResistant ? "Resistant" : "Vulnerable"}
              </span>
            </dd>
          </div>
        </dl>
      </div>
      {boundary.flags.length > 0 ? (
        <div className="security-flags" style={{ marginTop: 12 }}>
          <span className="question-expected-label">Security flags</span>
          <div style={{ marginTop: 4 }}>
            {boundary.flags.map((flag) => (
              <span key={flag} className="security-flag">{flag}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
