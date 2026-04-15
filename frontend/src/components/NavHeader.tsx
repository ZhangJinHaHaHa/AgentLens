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
          {title}
        </Link>
        {backHref ? (
          <Link to={backHref} className="nav-header-back">
            {backLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
