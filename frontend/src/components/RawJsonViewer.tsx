import { useState } from "react";

interface RawJsonViewerProps {
  json: string;
  title?: string;
}

export function RawJsonViewer({
  json,
  title = "Raw JSON"
}: RawJsonViewerProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  let formatted: string;
  try {
    formatted = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    formatted = json;
  }

  return (
    <section className="hero-card raw-json-section">
      <button
        type="button"
        className="json-toggle-button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="raw-json-content"
      >
        <h2 className="json-toggle-title">{title}</h2>
        <span className="json-toggle-indicator">{isExpanded ? "Collapse" : "Expand"}</span>
      </button>
      {isExpanded ? (
        <pre id="raw-json-content" className="json-pre">
          <code>{formatted}</code>
        </pre>
      ) : null}
    </section>
  );
}
