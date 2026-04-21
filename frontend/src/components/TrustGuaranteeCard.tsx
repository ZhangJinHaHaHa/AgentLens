import { formatBondWei } from "../lib/format";

interface TrustGuaranteeCardProps {
  totalBond: bigint | number;
  reputationScore: number;
  auditCount: number;
  successfulAppeals: number;
  failedAppeals: number;
  blacklisted: boolean;
}

export function TrustGuaranteeCard({
  totalBond,
  reputationScore,
  auditCount,
  successfulAppeals,
  failedAppeals,
  blacklisted
}: TrustGuaranteeCardProps): JSX.Element {
  const bondDisplay = formatBondWei(totalBond);
  const totalAppeals = successfulAppeals + failedAppeals;

  return (
    <section className="hero-card trust-guarantee-card">
      <p className="eyebrow">Trust Guarantee</p>
      <h2>How This Agent Is Protected</h2>

      <div className="trust-guarantee__items">
        <div className="trust-guarantee__item">
          <div className="trust-guarantee__icon trust-guarantee__icon--bond">
            <span>1</span>
          </div>
          <div className="trust-guarantee__content">
            <h3 className="trust-guarantee__item-title">Stake Bond</h3>
            <p className="trust-guarantee__item-desc">
              This agent has staked <strong>{bondDisplay}</strong> as a performance guarantee.
              If the agent fails an audit, this bond can be penalized as compensation.
            </p>
          </div>
        </div>

        <div className="trust-guarantee__flow-arrow" />

        <div className="trust-guarantee__item">
          <div className="trust-guarantee__icon trust-guarantee__icon--audit">
            <span>2</span>
          </div>
          <div className="trust-guarantee__content">
            <h3 className="trust-guarantee__item-title">Automated Audit</h3>
            <p className="trust-guarantee__item-desc">
              Every agent undergoes rigorous testing across 6 capability dimensions.
              {auditCount > 0
                ? ` This agent has completed ${auditCount} audit${auditCount !== 1 ? "s" : ""}.`
                : " No audits completed yet."}
            </p>
          </div>
        </div>

        <div className="trust-guarantee__flow-arrow" />

        <div className="trust-guarantee__item">
          <div className="trust-guarantee__icon trust-guarantee__icon--dispute">
            <span>3</span>
          </div>
          <div className="trust-guarantee__content">
            <h3 className="trust-guarantee__item-title">Dispute Resolution</h3>
            <p className="trust-guarantee__item-desc">
              {totalAppeals > 0
                ? `${totalAppeals} dispute${totalAppeals !== 1 ? "s" : ""} filed. ${successfulAppeals} resolved in developer's favor, ${failedAppeals} upheld original result.`
                : "If the developer disagrees with an audit result, they can file a dispute. An independent review resolves it on-chain."}
            </p>
          </div>
        </div>

        <div className="trust-guarantee__flow-arrow" />

        <div className="trust-guarantee__item">
          <div className="trust-guarantee__icon trust-guarantee__icon--reputation">
            <span>4</span>
          </div>
          <div className="trust-guarantee__content">
            <h3 className="trust-guarantee__item-title">Reputation Tracking</h3>
            <p className="trust-guarantee__item-desc">
              {blacklisted
                ? "This agent has been blacklisted due to severe violations."
                : `Reputation score: ${reputationScore.toLocaleString()}/10,000. Every audit, dispute, and penalty is permanently recorded on-chain.`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
