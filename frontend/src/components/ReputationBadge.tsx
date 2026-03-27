interface ReputationBadgeProps {
  currentReputationScore: number;
  successfulAppeals: number;
  failedAppeals: number;
  reputationDelta: number;
}

interface ReputationLevel {
  label: string;
  className: string;
}

function getReputationLevel(score: number): ReputationLevel {
  if (score >= 8000) return { label: "Excellent", className: "reputation-badge--green" };
  if (score >= 5000) return { label: "Good", className: "reputation-badge--blue" };
  if (score >= 2000) return { label: "Fair", className: "reputation-badge--yellow" };
  if (score >= 500) return { label: "Poor", className: "reputation-badge--orange" };
  return { label: "Bad", className: "reputation-badge--red" };
}

const MAX_SCORE = 10_000;

export function ReputationBadge({
  currentReputationScore,
  successfulAppeals,
  failedAppeals,
  reputationDelta
}: ReputationBadgeProps): JSX.Element {
  const { label, className } = getReputationLevel(currentReputationScore);
  const percentage = ((currentReputationScore / MAX_SCORE) * 100).toFixed(1);
  const totalAppeals = successfulAppeals + failedAppeals;

  return (
    <div className={`reputation-badge ${className}`}>
      <div className="reputation-badge__header">
        <span className="reputation-badge__label">Reputation Score</span>
        <span className="reputation-badge__value">
          {currentReputationScore.toLocaleString()}/{MAX_SCORE.toLocaleString()}
        </span>
      </div>
      <div className="reputation-badge__bar-track">
        <div
          className="reputation-badge__bar-fill"
          style={{ width: `${Math.min(Number(percentage), 100)}%` }}
        />
      </div>
      <div className="reputation-badge__meta">
        <span className="reputation-badge__percentage">{percentage}%</span>
        <span className="reputation-badge__level">Level: {label}</span>
      </div>
      <div className="reputation-badge__footer">
        <span className="reputation-badge__delta">
          Delta: {reputationDelta >= 0 ? `+${reputationDelta}` : String(reputationDelta)}
        </span>
        {totalAppeals > 0 ? (
          <span className="reputation-badge__details">
            {successfulAppeals} approved / {failedAppeals} rejected appeals
          </span>
        ) : (
          <span className="reputation-badge__details">No appeal history</span>
        )}
      </div>
    </div>
  );
}
