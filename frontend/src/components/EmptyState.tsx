interface EmptyStateProps {
  title: string;
  description: string;
  /** When true, shows Popo waiting illustration (no agents at all).
   *  When false (default), shows a lighter "no results" state. */
  showPopo?: boolean;
}

export function EmptyState({ title, description, showPopo = false }: EmptyStateProps): JSX.Element {
  return (
    <section className="empty-state">
      {showPopo ? (
        <div className="empty-state__popo">
          <img
            src="/popo-mascot.png"
            alt="Popo the mascot"
            className="empty-state__popo-img"
          />
          <p className="empty-state__popo-caption">
            Popo is waiting for the first agent to be audited...
          </p>
        </div>
      ) : (
        <div className="empty-state__icon">🔍</div>
      )}
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__desc">{description}</p>
    </section>
  );
}
