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
      <div className="marketplace-hero__badge">Trusted Agent Infrastructure</div>
      <h1 className="marketplace-hero__headline">
        Discover Verified AI Agents
      </h1>
      <p className="marketplace-hero__subtitle">
        Browse audited agents with on-chain reputation, TEE verification, and dimensional capability scoring.
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
            <span className="marketplace-hero__stat-label">Avg Score</span>
          </div>
        </div>
      ) : (
        <div className="marketplace-hero__onboarding">
          <p className="marketplace-hero__onboarding-text">
            The registry is ready. Agents will appear here once registered and audited on-chain.
          </p>
        </div>
      )}

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
