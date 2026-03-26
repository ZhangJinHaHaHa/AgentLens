interface EvidenceInfoProps {
  reportHash: string;
  reportCID: string;
  manifestHash: string;
  manifestUrl: string;
  hashVerified: boolean;
  sourceUrl?: string;
}

export function EvidenceInfo({
  reportHash,
  reportCID,
  manifestHash,
  manifestUrl,
  hashVerified,
  sourceUrl
}: EvidenceInfoProps): JSX.Element {
  return (
    <section className="hero-card">
      <h2>Evidence information</h2>
      <div className="verification-badge-container">
        <span
          className={`verification-badge ${hashVerified ? "verification-badge--verified" : "verification-badge--unverified"}`}
        >
          {hashVerified ? "Hash verified" : "Hash not verified"}
        </span>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Report hash</dt>
          <dd className="mono-text">{reportHash || "Not available"}</dd>
        </div>
        <div>
          <dt>Report CID</dt>
          <dd className="mono-text">{reportCID || "Not available"}</dd>
        </div>
        <div>
          <dt>Manifest hash</dt>
          <dd className="mono-text">{manifestHash || "Not available"}</dd>
        </div>
        <div>
          <dt>Manifest URL</dt>
          <dd>{manifestUrl || "Not available"}</dd>
        </div>
        {sourceUrl ? (
          <div>
            <dt>Source URL</dt>
            <dd>{sourceUrl}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
