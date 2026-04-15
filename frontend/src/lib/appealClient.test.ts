import { describe, expect, it, vi } from "vitest";

import { readLatestAppeal, submitAppeal } from "./appealClient";

describe("submitAppeal", () => {
  it("posts the appeal payload to the configured endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ appealId: "apl-001", status: "reviewing" }), {
        status: 202,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await submitAppeal(
      {
        tokenId: 1n,
        auditId: 2n,
        auditIndex: 0,
        reason: "The sandbox blocked a declared host.",
        reportCID: "bafy-report",
        reportHash: "0x1234",
        manifestUrl: "https://example.com/manifest.json"
      },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/appeals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tokenId: "1",
        auditId: "2",
        auditIndex: 0,
        reason: "The sandbox blocked a declared host.",
        reportCID: "bafy-report",
        reportHash: "0x1234",
        manifestUrl: "https://example.com/manifest.json"
      })
    });
    expect(result).toEqual({
      ok: true,
      appealId: "apl-001",
      status: "reviewing"
    });
  });

  it("returns a descriptive error when the endpoint rejects the appeal", async () => {
    const result = await submitAppeal(
      {
        tokenId: 1n,
        auditId: 2n,
        auditIndex: 0,
        reason: "Need human review."
      },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Appeal reason is too short." }), {
            status: 400,
            headers: {
              "Content-Type": "application/json"
            }
          })
        )
      }
    );

    expect(result).toEqual({
      ok: false,
      error: "Appeal reason is too short."
    });
  });

  it("returns a fallback error when the request fails before a response arrives", async () => {
    const result = await submitAppeal(
      {
        tokenId: 1n,
        auditId: 2n,
        auditIndex: 0,
        reason: "Need human review."
      },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl: vi.fn().mockRejectedValue(new Error("network down"))
      }
    );

    expect(result).toEqual({
      ok: false,
      error: "Failed to submit the appeal request."
    });
  });

  it("reads the latest appeal status for a tokenId and auditId", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          appealId: "apl-001",
          status: "reviewing",
          createdAt: "2026-03-30T10:20:00.000Z"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    const result = await readLatestAppeal(
      {
        tokenId: 1n,
        auditId: 2n
      },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl
      }
    );

    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/appeals?tokenId=1&auditId=2");
    expect(result).toEqual({
      ok: true,
      appealId: "apl-001",
      status: "reviewing",
      createdAt: "2026-03-30T10:20:00.000Z"
    });
  });

  it("returns not_found when no appeal ticket exists yet", async () => {
    const result = await readLatestAppeal(
      {
        tokenId: 1n,
        auditId: 2n
      },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ error: "Appeal not found." }), {
            status: 404,
            headers: {
              "Content-Type": "application/json"
            }
          })
        )
      }
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "NOT_FOUND",
      error: "Appeal not found."
    });
  });

  it("preserves approved and rejected review statuses from the appeal api", async () => {
    const approved = await readLatestAppeal(
      { tokenId: 1n, auditId: 2n },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              appealId: "apl-001",
              status: "approved",
              createdAt: "2026-03-30T10:20:00.000Z"
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
        )
      }
    );
    const rejected = await readLatestAppeal(
      { tokenId: 1n, auditId: 2n },
      {
        endpointUrl: "https://api.example.com/appeals",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              appealId: "apl-002",
              status: "rejected",
              createdAt: "2026-03-30T10:21:00.000Z"
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
        )
      }
    );

    expect(approved).toMatchObject({ ok: true, status: "approved" });
    expect(rejected).toMatchObject({ ok: true, status: "rejected" });
  });
});
