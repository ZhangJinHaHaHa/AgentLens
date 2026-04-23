interface AppealTimelineEntry {
  appealId: number;
  auditId: number;
  filedAt: string;
  resolvedAt?: string;
  outcome: "Pending" | "Approved" | "Rejected";
  appealCID?: string;
}

interface AppealHistoryTimelineProps {
  appeals: AppealTimelineEntry[];
}

function outcomeClassName(outcome: string): string {
  switch (outcome) {
    case "Approved":
      return "timeline-outcome--approved";
    case "Rejected":
      return "timeline-outcome--rejected";
    default:
      return "timeline-outcome--pending";
  }
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "Approved":
      return "Resolved in developer's favor";
    case "Rejected":
      return "Original audit result upheld";
    default:
      return "Under review";
  }
}

function formatTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return isoString;
  }
}

export function AppealHistoryTimeline({ appeals }: AppealHistoryTimelineProps): JSX.Element {
  if (appeals.length === 0) {
    return <p className="appeal-timeline-empty">No dispute history for this agent.</p>;
  }

  return (
    <div className="appeal-timeline">
      <h3>Dispute History</h3>
      <p className="appeal-timeline__intro">
        Each dispute follows a structured review process. The developer provides evidence,
        an independent arbitrator reviews the case, and the outcome is recorded on-chain.
      </p>
      <ul className="appeal-timeline__list">
        {appeals.map((entry) => (
          <li key={entry.appealId} className="appeal-timeline__item">
            <div className="appeal-timeline__header">
              <span className="appeal-timeline__id">Dispute #{entry.appealId}</span>
              <span className={`appeal-timeline__outcome ${outcomeClassName(entry.outcome)}`}>
                {outcomeLabel(entry.outcome)}
              </span>
            </div>
            <div className="appeal-timeline__meta">
              <span>Audit #{entry.auditId}</span>
              <span>Filed: {formatTimestamp(entry.filedAt)}</span>
              {entry.resolvedAt ? (
                <span>Resolved: {formatTimestamp(entry.resolvedAt)}</span>
              ) : null}
            </div>
            {entry.appealCID ? (
              <div className="appeal-timeline__cid">Evidence: {entry.appealCID}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type { AppealTimelineEntry };
