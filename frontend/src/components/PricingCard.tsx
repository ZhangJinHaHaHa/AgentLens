import { formatPriceEth } from "../lib/format";

interface PricingCardProps {
  pricePerDay: bigint;
  buyPrice: bigint;
  configured: boolean;
  accessCount: number | null;
}

export function PricingCard({
  pricePerDay,
  buyPrice,
  configured,
  accessCount
}: PricingCardProps): JSX.Element {
  if (!configured) {
    return (
      <section className="hero-card pricing-card">
        <p className="eyebrow">Pricing</p>
        <h2>Access Not Configured</h2>
        <p className="intro">
          This agent has not set pricing yet. Contact the developer directly for access.
        </p>
      </section>
    );
  }

  return (
    <section className="hero-card pricing-card">
      <p className="eyebrow">Pricing</p>
      <h2>Access This Agent</h2>

      <div className="pricing-card__grid">
        <div className="pricing-card__option">
          <span className="pricing-card__type">Rental</span>
          <span className="pricing-card__amount">{formatPriceEth(pricePerDay)}</span>
          <span className="pricing-card__unit">per day</span>
        </div>
        <div className="pricing-card__option">
          <span className="pricing-card__type">Purchase</span>
          <span className="pricing-card__amount">{formatPriceEth(buyPrice)}</span>
          <span className="pricing-card__unit">one-time</span>
        </div>
      </div>

      {accessCount !== null && accessCount > 0 ? (
        <div className="pricing-card__popularity">
          <span className="pricing-card__popularity-count">{accessCount}</span>
          <span className="pricing-card__popularity-label">
            user{accessCount !== 1 ? "s" : ""} have accessed this agent
          </span>
        </div>
      ) : null}
    </section>
  );
}
