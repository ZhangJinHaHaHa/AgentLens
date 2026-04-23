import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { NavHeader } from "./NavHeader";

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

describe("NavHeader", () => {
  it("renders the brand link to home", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <NavHeader />
      </MemoryRouter>
    );

    const brand = screen.getByRole("link", { name: /agent shenji/i });
    expect(brand).toHaveAttribute("href", "/");
  });

  it("renders a custom title", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <NavHeader title="Custom Title" />
      </MemoryRouter>
    );

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  it("renders a back link when backHref is provided", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <NavHeader backHref="/agent/1" backLabel="Agent detail" />
      </MemoryRouter>
    );

    const backLink = screen.getByText("Agent detail");
    expect(backLink).toHaveAttribute("href", "/agent/1");
  });

  it("does not render a back link when backHref is not provided", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <NavHeader />
      </MemoryRouter>
    );

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });
});
