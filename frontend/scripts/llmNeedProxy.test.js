import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  buildMiniMaxChatPayload,
  extractMiniMaxContent,
  parseMiniMaxJsonContent,
  readMiniMaxApiKey,
  resolveMiniMaxConfig
} from "./llmNeedProxy.mjs";

describe("readMiniMaxApiKey", () => {
  it("reads a direct env key without exposing it through VITE variables", async () => {
    await expect(readMiniMaxApiKey({ MINIMAX_API_KEY: "  secret-value  " })).resolves.toBe("secret-value");
  });

  it("reads a raw 1.env style key file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentlens-minimax-"));
    try {
      const file = join(dir, "1.env");
      await writeFile(file, "  secret-from-file  \n", "utf8");

      await expect(readMiniMaxApiKey({ MINIMAX_API_KEY_FILE: file })).resolves.toBe("secret-from-file");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads KEY=value files and ignores unrelated lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentlens-minimax-"));
    try {
      const file = join(dir, "minimax.env");
      await writeFile(file, "# comment\nOTHER=value\nMINIMAX_API_KEY=file-secret\n", "utf8");

      await expect(readMiniMaxApiKey({ MINIMAX_API_KEY_FILE: file })).resolves.toBe("file-secret");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty key when no local secret is configured", async () => {
    await expect(readMiniMaxApiKey({})).resolves.toBe("");
  });
});

describe("MiniMax proxy helpers", () => {
  it("resolves the OpenAI-compatible MiniMax defaults", () => {
    expect(resolveMiniMaxConfig({})).toEqual({
      baseUrl: "https://api.minimax.io/v1",
      model: "MiniMax-M2.7"
    });
  });

  it("builds a JSON-only chat completion payload", () => {
    const payload = buildMiniMaxChatPayload({
      query: "客服知识库自动回复",
      locale: "zh",
      taxonomy: {
        scenarioIds: ["customer-support"],
        tags: ["support"],
        accessTypes: ["saas"],
        riskLevels: ["low"],
        complexities: ["low"]
      },
      model: "MiniMax-M2.7"
    });

    expect(payload).toMatchObject({
      model: "MiniMax-M2.7",
      temperature: 0,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });
    expect(payload.messages[1].content).toContain("customer-support");
  });

  it("extracts chat completion content and reports unavailable responses", () => {
    expect(
      extractMiniMaxContent({
        choices: [{ message: { content: "{\"scenarioIds\":[]}" } }]
      })
    ).toBe("{\"scenarioIds\":[]}");

    expect(() => extractMiniMaxContent({ error: { message: "bad key" } })).toThrow("MiniMax API error");
  });

  it("parses JSON objects from MiniMax reasoning-wrapped content", () => {
    expect(
      parseMiniMaxJsonContent(
        '<think>reasoning text</think>```json\n{"scenarioIds":["customer-support"],"tags":["support"]}\n```'
      )
    ).toEqual({
      scenarioIds: ["customer-support"],
      tags: ["support"]
    });

    expect(() => parseMiniMaxJsonContent("<think>No structured payload</think>")).toThrow(
      "MiniMax response did not include a JSON object."
    );
  });
});
