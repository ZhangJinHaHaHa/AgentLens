interface PopularityIndicatorProps {
  accessCount: number;
}

export function PopularityIndicator({ accessCount }: PopularityIndicatorProps): JSX.Element {
  return (
    <span className="popularity-indicator">
      {accessCount} user{accessCount !== 1 ? "s" : ""}
    </span>
  );
}
