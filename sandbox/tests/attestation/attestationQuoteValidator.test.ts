import test from "node:test";
import assert from "node:assert/strict";

import {
  AttestationQuoteValidationError,
  createCompositeAttestationQuoteValidator,
  createExpectedAttestationQuoteValidator,
  createNoopAttestationQuoteValidator
} from "../../src/attestation/attestationQuoteValidator";

test("createNoopAttestationQuoteValidator accepts any quote payload", async () => {
  const validator = createNoopAttestationQuoteValidator();

  await assert.doesNotReject(() =>
    validator.validate({
      providerType: "nitro-enclave",
      measurement: "m".repeat(64),
      quoteFormat: "nitro",
      sessionPublicKey: "spk-123",
      quote: "quote-abc"
    })
  );
});

test("createExpectedAttestationQuoteValidator rejects mismatched expected fields", async () => {
  const validator = createExpectedAttestationQuoteValidator({
    expectedProviderType: "nitro-enclave",
    expectedMeasurement: "a".repeat(64),
    expectedQuoteFormat: "nitro"
  });

  await assert.rejects(
    () =>
      validator.validate({
        providerType: "mock-tee",
        measurement: "b".repeat(64),
        quoteFormat: "mock-quote",
        sessionPublicKey: "spk-123",
        quote: "quote-abc"
      }),
    /providerType does not match expected value/
  );
});

test("createExpectedAttestationQuoteValidator throws typed validation errors with stable codes", async () => {
  const validator = createExpectedAttestationQuoteValidator({
    expectedProviderType: "nitro-enclave",
    expectedMeasurement: "a".repeat(64),
    expectedQuoteFormat: "nitro"
  });

  await assert.rejects(
    () =>
      validator.validate({
        providerType: "mock-tee",
        measurement: "a".repeat(64),
        quoteFormat: "nitro",
        sessionPublicKey: "spk-123",
        quote: "quote-abc"
    }),
    (error: unknown) => {
      assert.ok(error instanceof AttestationQuoteValidationError);
      assert.equal(error.code, "PROVIDER_TYPE_MISMATCH");
      assert.equal(error.message, "providerType does not match expected value");
      return true;
    }
  );
});

test("createCompositeAttestationQuoteValidator runs all validators in order", async () => {
  const calls: string[] = [];

  const validator = createCompositeAttestationQuoteValidator([
    { validate: async () => { calls.push("first"); } },
    { validate: async () => { calls.push("second"); } }
  ]);

  await validator.validate({
    providerType: "test",
    measurement: "m".repeat(64),
    quoteFormat: "test",
    sessionPublicKey: "spk",
    quote: "q"
  });

  assert.deepEqual(calls, ["first", "second"]);
});

test("createCompositeAttestationQuoteValidator stops on first failure", async () => {
  const calls: string[] = [];

  const validator = createCompositeAttestationQuoteValidator([
    {
      validate: async () => {
        calls.push("first");
        throw new AttestationQuoteValidationError("PROVIDER_TYPE_MISMATCH", "fail");
      }
    },
    { validate: async () => { calls.push("second"); } }
  ]);

  await assert.rejects(
    () =>
      validator.validate({
        providerType: "test",
        measurement: "m".repeat(64),
        quoteFormat: "test",
        sessionPublicKey: "spk",
        quote: "q"
      }),
    /fail/
  );

  assert.deepEqual(calls, ["first"]);
});
