interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps): JSX.Element {
  return (
    <section className="hero-card">
      <p className="eyebrow">Read-only detail</p>
      <h2>{title}</h2>
      <p className="intro">{description}</p>
    </section>
  );
}
