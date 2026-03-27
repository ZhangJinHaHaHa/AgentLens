import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchFilterBar } from "./SearchFilterBar";

describe("SearchFilterBar", () => {
  it("renders a search input and status filter options", () => {
    render(
      <SearchFilterBar
        searchQuery=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/search by agent name/i)).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", () => {
    const onSearchChange = vi.fn();
    render(
      <SearchFilterBar
        searchQuery=""
        onSearchChange={onSearchChange}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/search by agent name/i), {
      target: { value: "Sentinel" }
    });

    expect(onSearchChange).toHaveBeenCalledWith("Sentinel");
  });

  it("calls onStatusFilterChange when a filter chip is clicked", () => {
    const onStatusFilterChange = vi.fn();
    render(
      <SearchFilterBar
        searchQuery=""
        onSearchChange={vi.fn()}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />
    );

    fireEvent.click(screen.getByText("Passed"));

    expect(onStatusFilterChange).toHaveBeenCalledWith("passed");
  });

  it("highlights the active filter chip", () => {
    const { container } = render(
      <SearchFilterBar
        searchQuery=""
        onSearchChange={vi.fn()}
        statusFilter="failed"
        onStatusFilterChange={vi.fn()}
      />
    );

    const activeChip = container.querySelector(".filter-chip--active");
    expect(activeChip).toBeTruthy();
    expect(activeChip?.textContent).toBe("Failed");
  });
});
