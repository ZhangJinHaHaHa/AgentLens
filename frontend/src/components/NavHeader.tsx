import { Link } from "react-router-dom";

interface NavHeaderProps {
  title?: string;
  backHref?: string;
  backLabel?: string;
}

export function NavHeader({
  title = "Agent Shenji",
  backHref,
  backLabel = "Back"
}: NavHeaderProps): JSX.Element {
  return (
    <header className="nav-header">
      <div className="nav-header-content">
        <Link to="/" className="nav-header-brand">
          <span className="nav-header-logo">S</span>
          <span className="nav-header-title">{title}</span>
        </Link>
        {backHref ? (
          <Link to={backHref} className="nav-header-back">
            <span className="nav-header-back-arrow">&larr;</span> {backLabel}
          </Link>
        ) : (
          <span className="nav-header-tagline">Trusted Agent Infrastructure</span>
        )}
      </div>
    </header>
  );
}
