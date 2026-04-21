interface ZkVerificationBadgeProps {
  type: "audit-score" | "fingerprint";
  verified: boolean;
  proofHash?: string;
  verifiedAt?: string;
}

export function ZkVerificationBadge({
  type,
  verified,
  proofHash,
  verifiedAt
}: ZkVerificationBadgeProps): JSX.Element {
  const label = type === "audit-score" ? "Score Proof" : "Identity Proof";

  if (!verified) {
    return (
      <span className="zk-badge zk-badge--absent" title="No ZK proof submitted">
        <span className="zk-badge__icon">ZK</span>
        <span className="zk-badge__label">{label}: Not proven</span>
      </span>
    );
  }

  const shortHash = proofHash ? `${proofHash.slice(0, 6)}...${proofHash.slice(-4)}` : "";
  const title = proofHash
    ? `ZK ${label} verified\nProof: ${proofHash}\n${verifiedAt ? `At: ${verifiedAt}` : ""}`
    : `ZK ${label} verified`;

  return (
    <span className="zk-badge zk-badge--verified" title={title}>
      <span className="zk-badge__icon">ZK</span>
      <span className="zk-badge__label">{label}: Verified</span>
      {shortHash ? <span className="zk-badge__hash">{shortHash}</span> : null}
    </span>
  );
}
