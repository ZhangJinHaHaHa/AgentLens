import { useState } from "react";

interface ReputationBadgeProps {
  currentReputationScore: number;
  successfulAppeals: number;
  failedAppeals: number;
  reputationDelta: number;
}

interface ReputationLevel {
  label: string;
  className: string;
  description: string;
}

function getReputationLevel(score: number): ReputationLevel {
  if (score >= 8000) return { label: "Excellent", className: "reputation-badge--green", description: "This agent has an outstanding track record with consistently high audit results." };
  if (score >= 5000) return { label: "Good", className: "reputation-badge--blue", description: "This agent has a solid track record with mostly positive audit results." };
  if (score >= 2000) return { label: "Fair", className: "reputation-badge--yellow", description: "This agent has a mixed track record. Review recent audits before making decisions." };
  if (score >= 500) return { label: "Poor", className: "reputation-badge--orange", description: "This agent has significant issues in its audit history. Proceed with caution." };
  return { label: "Bad", className: "reputation-badge--red", description: "This agent has a very poor track record. Not recommended for production use." };
}

const MAX_SCORE = 10_000;

export function ReputationBadge({
  currentReputationScore,
  successfulAppeals,
  failedAppeals,
  reputationDelta
}: ReputationBadgeProps): JSX.Element {
  const { label, className, description } = getReputationLevel(currentReputationScore);
  const percentage = ((currentReputationScore / MAX_SCORE) * 100).toFixed(1);
  const totalAppeals = successfulAppeals + failedAppeals;
  const [showExplanation, setShowExplanation] = useState(false);

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
            {successfulAppeals} approved / {failedAppeals} rejected disputes
          </span>
        ) : (
          <span className="reputation-badge__details">No dispute history</span>
        )}
      </div>
      <button
        type="button"
        className="reputation-badge__explain-toggle"
        onClick={() => setShowExplanation((prev) => !prev)}
      >
        {showExplanation ? "Hide explanation" : "What does this mean?"}
      </button>
      {showExplanation ? (
        <div className="reputation-badge__explanation">
          <p>{description}</p>
          <p>
            {reputationDelta >= 0
              ? `A delta of +${reputationDelta} means reputation has improved since the last update.`
              : `A delta of ${reputationDelta} means reputation has declined since the last update.`}
          </p>
          {totalAppeals > 0 ? (
            <p>
              {successfulAppeals} successful recovery{successfulAppeals !== 1 ? " instances" : ""} out of {totalAppeals} total dispute{totalAppeals !== 1 ? "s" : ""}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
