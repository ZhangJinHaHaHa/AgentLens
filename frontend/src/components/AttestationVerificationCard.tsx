import type { AttestationUiConfig } from "../config/appConfig";
import { AttestationBadge, isAttestationPresent } from "./AttestationBadge";

interface AttestationVerificationCardProps {
  attestationHash: string | undefined | null;
  expected?: AttestationUiConfig;
}

function formatHash(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X") ? value : `0x${value}`;
}

export function AttestationVerificationCard({
  attestationHash,
  expected
}: AttestationVerificationCardProps): JSX.Element {
  const attested = isAttestationPresent(attestationHash);

  return (
    <section className="hero-card">
      <header className="attestation-card__header">
        <h2>TEE attestation</h2>
        <AttestationBadge attestationHash={attestationHash} />
      </header>

      {attested ? (
        <p className="intro">
          The listener received a valid SGX DCAP v3 quote for this audit and only accepted it after
          verifying the enclave measurement and report_data binding against the pinned policy.
        </p>
      ) : (
        <p className="intro">
          This audit was recorded without a TEE attestation. It was produced either before the TEE
          loop was enabled or by a listener running in mock mode. No on-chain MRENCLAVE is bound to
          this record.
        </p>
      )}

      <dl className="detail-grid">
        <div>
          <dt>Attestation hash</dt>
          <dd>
            {attested ? (
              <code className="mono">{formatHash(attestationHash as string)}</code>
            ) : (
              <span className="muted">—</span>
            )}
          </dd>
        </div>
        {expected?.expectedProviderType ? (
          <div>
            <dt>Pinned provider type</dt>
            <dd>
              <code className="mono">{expected.expectedProviderType}</code>
            </dd>
          </div>
        ) : null}
        {expected?.expectedMeasurement ? (
          <div>
            <dt>Pinned MRENCLAVE</dt>
            <dd>
              <code className="mono">{formatHash(expected.expectedMeasurement)}</code>
            </dd>
          </div>
        ) : null}
        {expected?.expectedQuoteFormat ? (
          <div>
            <dt>Pinned quote format</dt>
            <dd>
              <code className="mono">{expected.expectedQuoteFormat}</code>
            </dd>
          </div>
        ) : null}
        {expected?.verifyReportDataBinding ? (
          <div>
            <dt>report_data binding</dt>
            <dd>
              <span className="badge-safe">
                Enforced: sha256(eventKey ‖ manifestHash ‖ evidenceRoot)
              </span>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
