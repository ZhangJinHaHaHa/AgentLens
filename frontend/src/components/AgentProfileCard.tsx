import type { AgentProfile } from "../lib/agentAuditRegistryClient";
import { formatBondWei, formatTimestamp, truncateAddress } from "../lib/format";

interface AgentProfileCardProps {
  profile: AgentProfile;
}

export function AgentProfileCard({ profile }: AgentProfileCardProps): JSX.Element {
  return (
    <section className="hero-card">
      <h2>Agent profile</h2>
      <dl className="detail-grid">
        <div>
          <dt>Name</dt>
          <dd>{profile.agentName}</dd>
        </div>
        <div>
          <dt>Developer</dt>
          <dd className="mono-text" title={profile.developer}>
            {truncateAddress(profile.developer)}
          </dd>
        </div>
        <div>
          <dt>Token ID</dt>
          <dd>{String(profile.tokenId)}</dd>
        </div>
        <div>
          <dt>Total bond</dt>
          <dd>{formatBondWei(profile.totalBond)}</dd>
        </div>
        <div>
          <dt>Blacklisted</dt>
          <dd>
            <span className={profile.blacklisted ? "badge-danger" : "badge-safe"}>
              {profile.blacklisted ? "Yes" : "No"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Audit count</dt>
          <dd>{String(profile.auditCount)}</dd>
        </div>
        <div>
          <dt>Created at</dt>
          <dd>{formatTimestamp(profile.createdAt)}</dd>
        </div>
        <div>
          <dt>Last audit at</dt>
          <dd>{formatTimestamp(profile.lastAuditAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
