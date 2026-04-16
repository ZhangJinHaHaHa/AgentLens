import { ReviewAggregateBar } from "./ReviewAggregateBar";
import { ReviewCard } from "./ReviewCard";
import { ReviewSubmitForm } from "./ReviewSubmitForm";

interface ReviewData {
  reviewer: string;
  timestamp: string;
  ratings: number[];  // 0=Bad, 1=Neutral, 2=Good
  commentText?: string;
}

interface ReviewSectionProps {
  tokenId: string;
  goodRatios: number[];
  neutralRatios: number[];
  reviews: ReviewData[];
  hasAccess: boolean;
  hasReviewed: boolean;
  onSubmitReview?: (ratings: number[], commentText: string) => Promise<void>;
}

export function ReviewSection({
  tokenId,
  goodRatios,
  neutralRatios,
  reviews,
  hasAccess,
  hasReviewed,
  onSubmitReview
}: ReviewSectionProps): JSX.Element {
  const hasData = goodRatios.some((r) => r > 0) || neutralRatios.some((r) => r > 0);

  return (
    <section className="hero-card">
      <h2>User reviews</h2>
      <p className="intro">Community ratings across 6 dimensions (on-chain) with optional comments (off-chain).</p>

      {hasData ? (
        <ReviewAggregateBar goodRatios={goodRatios} neutralRatios={neutralRatios} />
      ) : (
        <p className="review-empty">No reviews yet.</p>
      )}

      {reviews.length > 0 ? (
        <div className="review-list">
          {reviews.map((review, index) => (
            <ReviewCard key={index} {...review} />
          ))}
        </div>
      ) : null}

      {hasAccess && !hasReviewed && onSubmitReview ? (
        <div className="review-form-container">
          <h3>Submit your review</h3>
          <ReviewSubmitForm onSubmit={onSubmitReview} />
        </div>
      ) : null}

      {!hasAccess ? (
        <p className="review-access-note">
          You need to rent or purchase access to this agent before submitting a review.
        </p>
      ) : null}

      {hasReviewed ? (
        <p className="review-access-note">You have already reviewed this agent.</p>
      ) : null}
    </section>
  );
}
