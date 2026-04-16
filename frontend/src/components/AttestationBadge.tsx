const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function normalizeHash(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

export function isAttestationPresent(attestationHash: string | undefined | null): boolean {
  if (typeof attestationHash !== "string" || attestationHash.trim().length === 0) {
    return false;
  }

  const normalized = normalizeHash(attestationHash);
  if (normalized.length === 0) {
    return false;
  }

  return normalized !== normalizeHash(ZERO_HASH);
}

function shortenHash(hash: string): string {
  const normalized = hash.startsWith("0x") || hash.startsWith("0X") ? hash : `0x${hash}`;
  if (normalized.length <= 12) {
    return normalized;
  }
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
}

interface AttestationBadgeProps {
  attestationHash: string | undefined | null;
  label?: string;
}

export function AttestationBadge({ attestationHash, label }: AttestationBadgeProps): JSX.Element {
  if (!isAttestationPresent(attestationHash)) {
    return (
      <span
        className="attestation-badge attestation-badge--absent"
        title="This audit was recorded without a TEE attestation (mock or legacy path)."
      >
        Not attested
      </span>
    );
  }

  const hash = attestationHash as string;
  const displayLabel = label ?? "SGX-DCAP verified";

  return (
    <span
      className="attestation-badge attestation-badge--verified"
      title={`Attestation hash: ${hash}`}
    >
      <span className="attestation-badge__label">{displayLabel}</span>
      <span className="attestation-badge__hash">{shortenHash(hash)}</span>
    </span>
  );
}
