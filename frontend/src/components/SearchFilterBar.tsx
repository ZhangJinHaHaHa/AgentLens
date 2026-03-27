import type { AuditStatusFilter } from "../lib/auditStatus";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: AuditStatusFilter;
  onStatusFilterChange: (filter: AuditStatusFilter) => void;
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

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange
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
      <fieldset className="status-filter-group">
        <legend className="sr-only">Filter by status</legend>
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
    </div>
  );
}
