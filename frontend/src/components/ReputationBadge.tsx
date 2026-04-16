interface ReputationBadgeProps {
  successfulAppeals: number;
  failedAppeals: number;
  reputationDelta: number;
}

function getReputationLevel(delta: number): { label: string; className: string } {
  if (delta >= 3) return { label: "Excellent", className: "reputation-badge--green" };
  if (delta >= 1) return { label: "Good", className: "reputation-badge--green" };
  if (delta === 0) return { label: "Neutral", className: "reputation-badge--yellow" };
  if (delta >= -2) return { label: "Poor", className: "reputation-badge--yellow" };
  return { label: "Bad", className: "reputation-badge--red" };
}

export function ReputationBadge({
  successfulAppeals,
  failedAppeals,
  reputationDelta
}: ReputationBadgeProps): JSX.Element {
  const { label, className } = getReputationLevel(reputationDelta);
  const totalAppeals = successfulAppeals + failedAppeals;

  return (
    <div className={`reputation-badge ${className}`}>
      <span className="reputation-badge__label">Reputation</span>
      <span className="reputation-badge__level">{label}</span>
      <span className="reputation-badge__delta">
        {reputationDelta >= 0 ? `+${reputationDelta}` : String(reputationDelta)}
      </span>
      {totalAppeals > 0 ? (
        <span className="reputation-badge__details">
          {successfulAppeals} approved / {failedAppeals} rejected
        </span>
      ) : (
        <span className="reputation-badge__details">No appeal history</span>
      )}
    </div>
  );
}
