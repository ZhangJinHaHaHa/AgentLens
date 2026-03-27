interface ReviewAggregateBarProps {
  /** 6-element array of good ratios in basis points (0-10000). */
  goodRatios: number[];
  /** 6-element array of neutral ratios in basis points (0-10000). */
  neutralRatios: number[];
}

const DIMENSION_LABELS = [
  "Security",
  "Task Execution",
  "Cognitive",
  "Environment",
  "Engineering",
  "Compliance"
];

export function ReviewAggregateBar({ goodRatios, neutralRatios }: ReviewAggregateBarProps): JSX.Element {
  return (
    <div className="review-aggregate">
      {DIMENSION_LABELS.map((label, index) => {
        const goodPct = Math.round((goodRatios[index] ?? 0) / 100);
        const neutralPct = Math.round((neutralRatios[index] ?? 0) / 100);
        const badPct = 100 - goodPct - neutralPct;
        return (
          <div key={label} className="review-aggregate-row">
            <span className="review-aggregate-label">{label}</span>
            <div className="review-aggregate-track">
              <div
                className="review-aggregate-fill review-aggregate-fill--good"
                style={{ width: `${goodPct}%` }}
              />
              <div
                className="review-aggregate-fill review-aggregate-fill--neutral"
                style={{ width: `${neutralPct}%` }}
              />
            </div>
            <span className="review-aggregate-pct" title={`Good ${goodPct}% / Neutral ${neutralPct}% / Bad ${badPct}%`}>
              {goodPct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
