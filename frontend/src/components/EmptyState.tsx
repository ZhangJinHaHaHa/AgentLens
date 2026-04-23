interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps): JSX.Element {
  return (
    <section className="empty-state">
      <div className="empty-state__icon">?</div>
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__desc">{description}</p>
    </section>
  );
}
