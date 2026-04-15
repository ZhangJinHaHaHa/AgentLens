import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfigPanel } from "./ConfigPanel";

const configFixture = {
  rpcUrl: "https://rpc.edge.local",
  registryAddress: "0x1111111111111111111111111111111111111111",
  chainId: 31337,
  reportGatewayUrl: "https://gateway.example/ipfs/",
  appealApiUrl: "https://api.example.com/appeals"
};

describe("ConfigPanel", () => {
  it("renders a toggle button", () => {
    render(<ConfigPanel config={configFixture} />);

    expect(screen.getByText(/chain configuration/i)).toBeInTheDocument();
  });

  it("does not show config details by default", () => {
    render(<ConfigPanel config={configFixture} />);

    expect(screen.queryByText("https://rpc.edge.local")).not.toBeInTheDocument();
  });

  it("shows config details when expanded", () => {
    render(<ConfigPanel config={configFixture} />);

    fireEvent.click(screen.getByText(/chain configuration/i));

    expect(screen.getByText("https://rpc.edge.local")).toBeInTheDocument();
    expect(screen.getByText("0x1111111111111111111111111111111111111111")).toBeInTheDocument();
    expect(screen.getByText("31337")).toBeInTheDocument();
    expect(screen.getByText("https://gateway.example/ipfs/")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/appeals")).toBeInTheDocument();
  });

  it("hides config details when collapsed again", () => {
    render(<ConfigPanel config={configFixture} />);

    fireEvent.click(screen.getByText(/chain configuration/i));
    fireEvent.click(screen.getByText(/chain configuration/i));

    expect(screen.queryByText("https://rpc.edge.local")).not.toBeInTheDocument();
  });
});
