import { type FormEvent, useState } from "react";

// Rating values: 0=Bad, 1=Neutral, 2=Good
const RATING_BAD = 0;
const RATING_NEUTRAL = 1;
const RATING_GOOD = 2;

interface ReviewSubmitFormProps {
  onSubmit: (ratings: number[], commentText: string) => Promise<void>;
  disabled?: boolean;
}

const DIMENSION_LABELS = [
  "Security", "Task Execution", "Cognitive",
  "Environment", "Engineering", "Compliance"
];

const RATING_DISPLAY: Record<number, { label: string; symbol: string; className: string }> = {
  [RATING_GOOD]: { label: "Good", symbol: "+", className: "review-toggle--good" },
  [RATING_NEUTRAL]: { label: "Neutral", symbol: "~", className: "review-toggle--neutral" },
  [RATING_BAD]: { label: "Bad", symbol: "-", className: "review-toggle--bad" },
};

function cycleRating(current: number): number {
  if (current === RATING_GOOD) return RATING_NEUTRAL;
  if (current === RATING_NEUTRAL) return RATING_BAD;
  return RATING_GOOD;
}

export function ReviewSubmitForm({ onSubmit, disabled }: ReviewSubmitFormProps): JSX.Element {
  const [ratings, setRatings] = useState<number[]>([2, 2, 2, 2, 2, 2]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(index: number): void {
    setRatings((prev) => prev.map((v, i) => (i === index ? cycleRating(v) : v)));
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(ratings, comment.trim());
      setComment("");
      setRatings([2, 2, 2, 2, 2, 2]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="review-submit-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="review-toggle-grid">
        {DIMENSION_LABELS.map((label, index) => {
          const display = RATING_DISPLAY[ratings[index]] ?? RATING_DISPLAY[RATING_GOOD];
          return (
            <button
              key={label}
              type="button"
              className={`review-toggle ${display.className}`}
              onClick={() => handleToggle(index)}
              disabled={disabled || submitting}
              title={`Click to cycle: Good → Neutral → Bad`}
            >
              {display.symbol} {label}
            </button>
          );
        })}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Optional comment (stored off-chain, hash on-chain)"
        disabled={disabled || submitting}
      />
      {error ? <p role="alert" className="review-error">{error}</p> : null}
      <button type="submit" disabled={disabled || submitting}>
        {submitting ? "Submitting..." : "Submit review"}
      </button>
    </form>
  );
}
