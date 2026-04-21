import { formatBondWei } from "../lib/format";

interface AuditFailureExplainerProps {
  status: number;
  bondAmount: bigint | number;
  appealRequested: boolean;
  appealApproved: boolean;
}

// Status constants matching the contract enum
const STATUS_FAILED = 2;
const STATUS_SLASHED = 3;
const STATUS_COMPENSATED = 4;

export function AuditFailureExplainer({
  status,
  bondAmount,
  appealRequested,
  appealApproved
}: AuditFailureExplainerProps): JSX.Element | null {
  if (status === STATUS_FAILED) {
    return (
      <div className="failure-explainer failure-explainer--failed">
        <h3 className="failure-explainer__title">Audit Failed</h3>
        <p className="failure-explainer__desc">
          This agent did not meet the required audit criteria. No bond was penalized.
          The developer can address the issues and request a new audit.
        </p>
      </div>
    );
  }

  if (status === STATUS_SLASHED) {
    const bondDisplay = formatBondWei(bondAmount);

    if (appealRequested && !appealApproved) {
      return (
        <div className="failure-explainer failure-explainer--disputed">
          <h3 className="failure-explainer__title">Penalty Under Dispute</h3>
          <p className="failure-explainer__desc">
            This agent was penalized ({bondDisplay} bond affected) due to security or compliance violations.
            The developer has filed a dispute, which is currently under independent review.
          </p>
        </div>
      );
    }

    return (
      <div className="failure-explainer failure-explainer--slashed">
        <h3 className="failure-explainer__title">Bond Penalized</h3>
        <p className="failure-explainer__desc">
          This agent was penalized. {bondDisplay} bond was affected due to security or compliance violations.
          The developer may file a dispute for independent review.
        </p>
      </div>
    );
  }

  if (status === STATUS_COMPENSATED) {
    return (
      <div className="failure-explainer failure-explainer--compensated">
        <h3 className="failure-explainer__title">Penalty Reversed</h3>
        <p className="failure-explainer__desc">
          After independent review, the original penalty was reversed.
          The bond has been returned to the developer.
        </p>
      </div>
    );
  }

  return null;
}
