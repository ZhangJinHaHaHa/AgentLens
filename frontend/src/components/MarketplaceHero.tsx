import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { parseTokenIdInput } from "../lib/tokenId";

interface MarketplaceHeroProps {
  totalAgents: number;
  attestedCount: number;
  averageScore: number | null;
}

export function MarketplaceHero({
  totalAgents,
  attestedCount,
  averageScore
}: MarketplaceHeroProps): JSX.Element {
  const navigate = useNavigate();
  const [showLookup, setShowLookup] = useState(false);
  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = parseTokenIdInput(tokenId);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    navigate(`/agent/${parsed.normalized}`);
  }

  const hasData = totalAgents > 0;

  return (
    <section className="marketplace-hero">
      <div className="marketplace-hero__badge">Trusted Agent Marketplace</div>
      <h1 className="marketplace-hero__headline">
        Before You Hire an AI Agent,<br />Know Exactly What You&apos;re Getting
      </h1>
      <p className="marketplace-hero__subtitle">
        Every agent here has been audited on-chain, stress-tested in a sandboxed environment,
        and verified through TEE attestation. You see the risk profile, the evidence, and the
        track record — before you commit.
      </p>

      {hasData ? (
        <div className="marketplace-hero__stats">
          <div className="marketplace-hero__stat">
            <span className="marketplace-hero__stat-value">{totalAgents}</span>
            <span className="marketplace-hero__stat-label">Agents Listed</span>
          </div>
          <div className="marketplace-hero__stat marketplace-hero__stat--accent">
            <span className="marketplace-hero__stat-value">{attestedCount}</span>
            <span className="marketplace-hero__stat-label">TEE Verified</span>
          </div>
          <div className="marketplace-hero__stat">
            <span className="marketplace-hero__stat-value">
              {averageScore !== null ? averageScore : "--"}
            </span>
            <span className="marketplace-hero__stat-label">Avg Audit Score</span>
          </div>
        </div>
      ) : (
        <div className="marketplace-hero__onboarding">
          <p className="marketplace-hero__onboarding-text">
            The first marketplace where AI agent trust is verifiable, not just claimed.
            Agents are being audited and listed — check back soon.
          </p>
        </div>
      )}

      <div className="marketplace-hero__roles">
        <div className="marketplace-hero__role">
          <span className="marketplace-hero__role-icon">🔍</span>
          <div>
            <strong>Buyers</strong>
            <p>Browse audited agents, compare risk profiles, and access only what you trust.</p>
          </div>
        </div>
        <div className="marketplace-hero__role">
          <span className="marketplace-hero__role-icon">🚀</span>
          <div>
            <strong>Developers</strong>
            <p>List your agent, pass the audit, and build a verifiable reputation on-chain.</p>
          </div>
        </div>
        <div className="marketplace-hero__role">
          <span className="marketplace-hero__role-icon">🛡️</span>
          <div>
            <strong>Auditors</strong>
            <p>Run sandboxed evaluations, submit dimensional scores, and anchor evidence on-chain.</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="search-advanced-toggle"
        onClick={() => setShowLookup((prev) => !prev)}
      >
        {showLookup ? "Hide direct lookup" : "Direct lookup by Token ID"}
      </button>

      {showLookup ? (
        <form className="token-form" onSubmit={handleSubmit}>
          <label htmlFor="tokenId">tokenId</label>
          <input
            id="tokenId"
            name="tokenId"
            type="text"
            inputMode="numeric"
            placeholder="Enter a token ID (e.g. 1)"
            value={tokenId}
            onChange={(event) => setTokenId(event.target.value)}
          />
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit">Search</button>
        </form>
      ) : null}
    </section>
  );
}
