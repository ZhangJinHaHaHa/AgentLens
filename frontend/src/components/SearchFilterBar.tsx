import type { AuditStatusFilter } from "../lib/auditStatus";

export type RiskLevelFilter = "all" | "low" | "moderate" | "elevated" | "high";
export type AttestationFilter = "all" | "verified" | "unverified";
export type TaskTypeFilter =
  | "all"
  | "defi"
  | "chatbot"
  | "devops"
  | "data"
  | "automation";
export type PriceRangeFilter = "all" | "free" | "low" | "mid" | "high";
export type SortOrder =
  | "default"
  | "score_desc"
  | "reputation_desc"
  | "access_desc"
  | "price_asc"
  | "fresh_desc";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: AuditStatusFilter;
  onStatusFilterChange: (filter: AuditStatusFilter) => void;
  riskLevelFilter?: RiskLevelFilter;
  onRiskLevelFilterChange?: (filter: RiskLevelFilter) => void;
  attestationFilter?: AttestationFilter;
  onAttestationFilterChange?: (filter: AttestationFilter) => void;
  taskTypeFilter?: TaskTypeFilter;
  onTaskTypeFilterChange?: (filter: TaskTypeFilter) => void;
  priceRangeFilter?: PriceRangeFilter;
  onPriceRangeFilterChange?: (filter: PriceRangeFilter) => void;
  sortOrder?: SortOrder;
  onSortOrderChange?: (order: SortOrder) => void;
}

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: AuditStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" }
];

const RISK_FILTER_OPTIONS: ReadonlyArray<{ value: RiskLevelFilter; label: string }> = [
  { value: "all", label: "Any Risk" },
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "elevated", label: "Elevated" },
  { value: "high", label: "High" }
];

const ATTESTATION_FILTER_OPTIONS: ReadonlyArray<{ value: AttestationFilter; label: string }> = [
  { value: "all", label: "Any" },
  { value: "verified", label: "TEE Verified" },
  { value: "unverified", label: "Not Verified" }
];

const TASK_TYPE_OPTIONS: ReadonlyArray<{ value: TaskTypeFilter; label: string }> = [
  { value: "all", label: "All Tasks" },
  { value: "defi", label: "DeFi / Finance" },
  { value: "chatbot", label: "Chatbot" },
  { value: "devops", label: "DevOps" },
  { value: "data", label: "Data Analysis" },
  { value: "automation", label: "Automation" }
];

const PRICE_RANGE_OPTIONS: ReadonlyArray<{ value: PriceRangeFilter; label: string }> = [
  { value: "all", label: "Any Price" },
  { value: "free", label: "Not Listed" },
  { value: "low", label: "< 0.01 ETH/day" },
  { value: "mid", label: "0.01–0.1 ETH/day" },
  { value: "high", label: "> 0.1 ETH/day" }
];

const SORT_OPTIONS: ReadonlyArray<{ value: SortOrder; label: string }> = [
  { value: "default", label: "Default" },
  { value: "score_desc", label: "Highest Score" },
  { value: "reputation_desc", label: "Best Reputation" },
  { value: "access_desc", label: "Most Popular" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "fresh_desc", label: "Recently Audited" }
];

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  riskLevelFilter,
  onRiskLevelFilterChange,
  attestationFilter,
  onAttestationFilterChange,
  taskTypeFilter,
  onTaskTypeFilterChange,
  priceRangeFilter,
  onPriceRangeFilterChange,
  sortOrder,
  onSortOrderChange
}: SearchFilterBarProps): JSX.Element {
  return (
    <div className="search-filter-bar">
      <div className="search-filter-bar__top">
        <div className="search-input-wrapper">
          <label htmlFor="agent-search" className="sr-only">Search agents</label>
          <input
            id="agent-search"
            type="text"
            placeholder="Search by agent name or token ID..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="search-input"
          />
        </div>
        {sortOrder !== undefined && onSortOrderChange ? (
          <div className="sort-select-wrapper">
            <label htmlFor="sort-select" className="sr-only">Sort by</label>
            <select
              id="sort-select"
              className="sort-select"
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="filter-groups">
        <fieldset className="status-filter-group">
          <legend className="filter-group-legend">Status</legend>
          {STATUS_FILTER_OPTIONS.map((option) => (
            <label key={option.value} className="filter-chip-label">
              <input type="radio" name="statusFilter" value={option.value}
                checked={statusFilter === option.value}
                onChange={() => onStatusFilterChange(option.value)}
                className="sr-only" />
              <span className={`filter-chip ${statusFilter === option.value ? "filter-chip--active" : ""}`}>
                {option.label}
              </span>
            </label>
          ))}
        </fieldset>

        {taskTypeFilter !== undefined && onTaskTypeFilterChange ? (
          <fieldset className="status-filter-group">
            <legend className="filter-group-legend">Task Type</legend>
            {TASK_TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="filter-chip-label">
                <input type="radio" name="taskTypeFilter" value={option.value}
                  checked={taskTypeFilter === option.value}
                  onChange={() => onTaskTypeFilterChange(option.value)}
                  className="sr-only" />
                <span className={`filter-chip ${taskTypeFilter === option.value ? "filter-chip--active" : ""}`}>
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {riskLevelFilter !== undefined && onRiskLevelFilterChange ? (
          <fieldset className="status-filter-group">
            <legend className="filter-group-legend">Risk</legend>
            {RISK_FILTER_OPTIONS.map((option) => (
              <label key={option.value} className="filter-chip-label">
                <input type="radio" name="riskFilter" value={option.value}
                  checked={riskLevelFilter === option.value}
                  onChange={() => onRiskLevelFilterChange(option.value)}
                  className="sr-only" />
                <span className={`filter-chip ${riskLevelFilter === option.value ? "filter-chip--active" : ""}`}>
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {priceRangeFilter !== undefined && onPriceRangeFilterChange ? (
          <fieldset className="status-filter-group">
            <legend className="filter-group-legend">Price</legend>
            {PRICE_RANGE_OPTIONS.map((option) => (
              <label key={option.value} className="filter-chip-label">
                <input type="radio" name="priceRangeFilter" value={option.value}
                  checked={priceRangeFilter === option.value}
                  onChange={() => onPriceRangeFilterChange(option.value)}
                  className="sr-only" />
                <span className={`filter-chip ${priceRangeFilter === option.value ? "filter-chip--active" : ""}`}>
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
                <input type="radio" name="attestationFilter" value={option.value}
                  checked={attestationFilter === option.value}
                  onChange={() => onAttestationFilterChange(option.value)}
                  className="sr-only" />
                <span className={`filter-chip ${attestationFilter === option.value ? "filter-chip--active" : ""}`}>
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
