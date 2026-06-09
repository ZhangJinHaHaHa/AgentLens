import { describe, expect, it } from "vitest";

import { buildAFlowSmokeConfig } from "./runAFlowSmoke.mjs";

describe("buildAFlowSmokeConfig", () => {
  it("uses local A-flow smoke defaults", () => {
    expect(buildAFlowSmokeConfig({})).toEqual({
      host: "127.0.0.1",
      bindHost: "127.0.0.1",
      port: 5175,
      browserHome: "/tmp/agentlens-a-flow-browser-home"
    });
  });
});
