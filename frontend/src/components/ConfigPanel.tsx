import { useState } from "react";

import type { AppConfig } from "../config/appConfig";

interface ConfigPanelProps {
  config: AppConfig;
}

export function ConfigPanel({ config }: ConfigPanelProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="config-panel">
      <button
        type="button"
        className="config-panel-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="config-panel-content"
      >
        Chain configuration {isExpanded ? "(hide)" : "(show)"}
      </button>
      {isExpanded ? (
        <div id="config-panel-content" className="config-panel-content">
          <dl className="config-panel-grid">
            <div>
              <dt>RPC URL</dt>
              <dd className="mono-text">{config.rpcUrl}</dd>
            </div>
            <div>
              <dt>Registry address</dt>
              <dd className="mono-text">{config.registryAddress}</dd>
            </div>
            <div>
              <dt>Chain ID</dt>
              <dd>{config.chainId}</dd>
            </div>
            {config.reportGatewayUrl ? (
              <div>
                <dt>Report gateway</dt>
                <dd className="mono-text">{config.reportGatewayUrl}</dd>
              </div>
            ) : null}
            {config.appealApiUrl ? (
              <div>
                <dt>Appeal API</dt>
                <dd className="mono-text">{config.appealApiUrl}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
