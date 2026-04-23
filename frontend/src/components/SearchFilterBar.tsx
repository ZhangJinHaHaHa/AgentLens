import type { AuditStatusFilter } from "../lib/auditStatus";

export type RiskLevelFilter = "all" | "low" | "moderate" | "elevated" | "high";
export type AttestationFilter = "all" | "verified" | "unverified";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: AuditStatusFilter;
  onStatusFilterChange: (filter: AuditStatusFilter) => void;
  riskLevelFilter?: RiskLevelFilter;
  onRiskLevelFilterChange?: (filter: RiskLevelFilter) => void;
  attestationFilter?: AttestationFilter;
  onAttestationFilterChange?: (filter: AttestationFilter) => void;
}

const STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: AuditStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" }
];

const RISK_FILTER_OPTIONS: ReadonlyArray<{
  value: RiskLevelFilter;
  label: string;
}> = [
  { value: "all", label: "Any Risk" },
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "elevated", label: "Elevated" },
  { value: "high", label: "High" }
];

const ATTESTATION_FILTER_OPTIONS: ReadonlyArray<{
  value: AttestationFilter;
  label: string;
}> = [
  { value: "all", label: "Any" },
  { value: "verified", label: "TEE Verified" },
  { value: "unverified", label: "Not Verified" }
];

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  riskLevelFilter,
  onRiskLevelFilterChange,
  attestationFilter,
  onAttestationFilterChange
}: SearchFilterBarProps): JSX.Element {
  return (
    <div className="search-filter-bar">
      <div className="search-input-wrapper">
        <label htmlFor="agent-search" className="sr-only">
          Search agents
        </label>
        <input
          id="agent-search"
          type="text"
          placeholder="Search by agent name or token ID..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-groups">
        <fieldset className="status-filter-group">
          <legend className="filter-group-legend">Status</legend>
          {STATUS_FILTER_OPTIONS.map((option) => (
            <label key={option.value} className="filter-chip-label">
              <input
                type="radio"
                name="statusFilter"
                value={option.value}
                checked={statusFilter === option.value}
                onChange={() => onStatusFilterChange(option.value)}
                className="sr-only"
              />
              <span
                className={`filter-chip ${statusFilter === option.value ? "filter-chip--active" : ""}`}
              >
                {option.label}
              </span>
            </label>
          ))}
        </fieldset>

        {riskLevelFilter !== undefined && onRiskLevelFilterChange ? (
          <fieldset className="status-filter-group">
            <legend className="filter-group-legend">Risk</legend>
            {RISK_FILTER_OPTIONS.map((option) => (
              <label key={option.value} className="filter-chip-label">
                <input
                  type="radio"
                  name="riskFilter"
                  value={option.value}
                  checked={riskLevelFilter === option.value}
                  onChange={() => onRiskLevelFilterChange(option.value)}
                  className="sr-only"
                />
                <span
                  className={`filter-chip ${riskLevelFilter === option.value ? "filter-chip--active" : ""}`}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {attestationFilter !== undefined && onAttestationFilterChange ? (
          <fieldset className="status-filter-group">
            <legend className="filter-group-legend">Verification</legend>
            {ATTESTATION_FILTER_OPTIONS.map((option) => (
              <label key={option.value} className="filter-chip-label">
                <input
                  type="radio"
                  name="attestationFilter"
                  value={option.value}
                  checked={attestationFilter === option.value}
                  onChange={() => onAttestationFilterChange(option.value)}
                  className="sr-only"
                />
                <span
                  className={`filter-chip ${attestationFilter === option.value ? "filter-chip--active" : ""}`}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}
