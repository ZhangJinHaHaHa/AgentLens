interface LoadingSkeletonProps {
  lines?: number;
  title?: string;
}

export function LoadingSkeleton({
  lines = 4,
  title = "Loading..."
}: LoadingSkeletonProps): JSX.Element {
  return (
    <section className="hero-card skeleton-card" aria-busy="true" aria-label={title}>
      <div className="skeleton-title" />
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton-line"
          style={{ width: `${60 + ((index * 17) % 40)}%` }}
        />
      ))}
    </section>
  );
}
