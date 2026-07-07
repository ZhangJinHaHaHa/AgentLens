import test from "node:test";
import assert from "node:assert/strict";

import {
  PublicHttpUrlError,
  assertPublicHttpUrl,
  fetchPublicHttpUrl,
  isPotentialPublicHttpUrl
} from "../../src/security/publicHttpUrl";

test("isPotentialPublicHttpUrl rejects local and metadata targets", () => {
  assert.equal(isPotentialPublicHttpUrl("http://localhost:8790/health"), false);
  assert.equal(isPotentialPublicHttpUrl("http://169.254.169.254/latest/meta-data"), false);
  assert.equal(isPotentialPublicHttpUrl("http://[::1]/"), false);
  assert.equal(isPotentialPublicHttpUrl("https://example.com/docs"), true);
});

test("assertPublicHttpUrl rejects DNS names resolving to private addresses", async () => {
  await assert.rejects(
    () =>
      assertPublicHttpUrl("https://safe-looking.example/", {
        lookupHost: async () => [{ address: "10.0.0.5", family: 4 }]
      }),
    PublicHttpUrlError
  );
});

test("fetchPublicHttpUrl validates redirect targets", async () => {
  await assert.rejects(
    () =>
      fetchPublicHttpUrl("https://example.com/start", {
        lookupHost: async () => [{ address: "93.184.216.34", family: 4 }],
        fetchImpl: async () =>
          new Response("", {
            status: 302,
            headers: { location: "http://127.0.0.1/admin" }
          })
      }),
    PublicHttpUrlError
  );
});
