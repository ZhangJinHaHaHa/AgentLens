import { truncateAddress } from "../lib/format";

interface ReviewCardProps {
  reviewer: string;
  timestamp: string;
  ratings: number[];  // 0=Bad, 1=Neutral, 2=Good
  commentText?: string;
}

const DIMENSION_LABELS = [
  "Security", "Task Exec", "Cognitive",
  "Environment", "Engineering", "Compliance"
];

function ratingBadgeClass(rating: number): string {
  if (rating === 2) return "review-good-badge--positive";
  if (rating === 1) return "review-good-badge--neutral";
  return "review-good-badge--negative";
}

function ratingSymbol(rating: number): string {
  if (rating === 2) return "+";
  if (rating === 1) return "~";
  return "-";
}

export function ReviewCard({ reviewer, timestamp, ratings, commentText }: ReviewCardProps): JSX.Element {
  return (
    <div className="review-card">
      <div className="review-card-header">
        <span className="mono-text">{truncateAddress(reviewer)}</span>
        <span className="review-timestamp">{timestamp}</span>
      </div>
      <div className="review-goods">
        {DIMENSION_LABELS.map((label, i) => (
          <span
            key={label}
            className={`review-good-badge ${ratingBadgeClass(ratings[i])}`}
          >
            {ratingSymbol(ratings[i])} {label}
          </span>
        ))}
      </div>
      {commentText ? (
        <p className="review-comment">{commentText}</p>
      ) : null}
    </div>
  );
}
