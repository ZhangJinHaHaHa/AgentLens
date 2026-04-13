import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  parseSgxDcapQuote,
  computeExpectedReportData,
  createSgxDcapQuoteValidator,
  buildMockSgxDcapQuote,
  SgxDcapValidationError
} from "../../src/attestation/sgxDcapQuoteValidator";

const SAMPLE_MRENCLAVE = "c" .repeat(64);
const SAMPLE_EVENT_KEY = "0xabc123:0";
const SAMPLE_MANIFEST_HASH = "a".repeat(64);
const SAMPLE_EVIDENCE_ROOT = "b".repeat(64);

function buildSampleReportData(): Buffer {
  return computeExpectedReportData(
    SAMPLE_EVENT_KEY,
    SAMPLE_MANIFEST_HASH,
    SAMPLE_EVIDENCE_ROOT
  );
}

function buildSampleQuoteHex(): string {
  return buildMockSgxDcapQuote({
    mrEnclave: SAMPLE_MRENCLAVE,
    reportData: buildSampleReportData()
  });
}

test("parseSgxDcapQuote extracts MRENCLAVE and report_data from a valid quote", () => {
  const quoteHex = buildSampleQuoteHex();
  const parsed = parseSgxDcapQuote(quoteHex);

  assert.equal(parsed.version, 3);
  assert.equal(parsed.teeType, 0);
  assert.equal(parsed.attKeyType, 2);
  assert.equal(parsed.mrEnclave, SAMPLE_MRENCLAVE);

  const expectedReportData = buildSampleReportData();
  assert.ok(parsed.reportData.equals(expectedReportData));
});

test("parseSgxDcapQuote rejects non-hex input", () => {
  assert.throws(
    () => parseSgxDcapQuote("not-valid-hex!"),
    (error: unknown) => {
      assert.ok(error instanceof SgxDcapValidationError);
      assert.equal(error.code, "INVALID_QUOTE_HEX");
      return true;
    }
  );
});

test("parseSgxDcapQuote rejects too-short quotes", () => {
  assert.throws(
    () => parseSgxDcapQuote("0300020000000000"),
    (error: unknown) => {
      assert.ok(error instanceof SgxDcapValidationError);
      assert.equal(error.code, "QUOTE_TOO_SHORT");
      return true;
    }
  );
});

test("parseSgxDcapQuote rejects wrong version", () => {
  const quoteHex = buildSampleQuoteHex();
  // Overwrite version bytes (first 4 hex chars) to version=4
  const tampered = "0400" + quoteHex.slice(4);

  assert.throws(
    () => parseSgxDcapQuote(tampered),
    (error: unknown) => {
      assert.ok(error instanceof SgxDcapValidationError);
      assert.equal(error.code, "INVALID_QUOTE_VERSION");
      return true;
    }
  );
});

test("parseSgxDcapQuote rejects non-SGX TEE type", () => {
  const quoteHex = buildSampleQuoteHex();
  // Overwrite tee_type at byte offset 4 (hex offset 8) to 0x81 (TDX)
  const tampered = quoteHex.slice(0, 8) + "81000000" + quoteHex.slice(16);

  assert.throws(
    () => parseSgxDcapQuote(tampered),
    (error: unknown) => {
      assert.ok(error instanceof SgxDcapValidationError);
      assert.equal(error.code, "INVALID_TEE_TYPE");
      return true;
    }
  );
});

test("computeExpectedReportData produces sha256(eventKey+manifestHash+evidenceRoot) in first 32 bytes", () => {
  const result = computeExpectedReportData(
    SAMPLE_EVENT_KEY,
    SAMPLE_MANIFEST_HASH,
    SAMPLE_EVIDENCE_ROOT
  );

  assert.equal(result.length, 64);

  const expectedDigest = createHash("sha256")
    .update(SAMPLE_EVENT_KEY + SAMPLE_MANIFEST_HASH + SAMPLE_EVIDENCE_ROOT)
    .digest();

  assert.ok(result.subarray(0, 32).equals(expectedDigest));
  assert.ok(result.subarray(32).equals(Buffer.alloc(32)));
});

test("createSgxDcapQuoteValidator passes when MRENCLAVE and report_data match", async () => {
  const quoteHex = buildSampleQuoteHex();
  const validator = createSgxDcapQuoteValidator({
    expectedMrEnclave: SAMPLE_MRENCLAVE,
    expectedEventKey: SAMPLE_EVENT_KEY,
    expectedManifestHash: SAMPLE_MANIFEST_HASH,
    expectedEvidenceRoot: SAMPLE_EVIDENCE_ROOT
  });

  await assert.doesNotReject(() =>
    validator.validate({
      providerType: "sgx-dcap",
      measurement: SAMPLE_MRENCLAVE,
      quoteFormat: "sgx-dcap-v3",
      sessionPublicKey: "spk",
      quote: quoteHex
    })
  );
});

test("createSgxDcapQuoteValidator rejects MRENCLAVE mismatch", async () => {
  const quoteHex = buildSampleQuoteHex();
  const validator = createSgxDcapQuoteValidator({
    expectedMrEnclave: "d".repeat(64)
  });

  await assert.rejects(
    () =>
      validator.validate({
        providerType: "sgx-dcap",
        measurement: SAMPLE_MRENCLAVE,
        quoteFormat: "sgx-dcap-v3",
        sessionPublicKey: "spk",
        quote: quoteHex
      }),
    (error: unknown) => {
      assert.ok(error instanceof SgxDcapValidationError);
      assert.equal(error.code, "MRENCLAVE_MISMATCH");
      return true;
    }
  );
});

test("createSgxDcapQuoteValidator rejects report_data mismatch", async () => {
  const quoteHex = buildSampleQuoteHex();
  const validator = createSgxDcapQuoteValidator({
    expectedEventKey: "0xDIFFERENT:1",
    expectedManifestHash: SAMPLE_MANIFEST_HASH,
    expectedEvidenceRoot: SAMPLE_EVIDENCE_ROOT
  });

  await assert.rejects(
    () =>
      validator.validate({
        providerType: "sgx-dcap",
        measurement: SAMPLE_MRENCLAVE,
        quoteFormat: "sgx-dcap-v3",
        sessionPublicKey: "spk",
        quote: quoteHex
      }),
    (error: unknown) => {
      assert.ok(error instanceof SgxDcapValidationError);
      assert.equal(error.code, "REPORT_DATA_MISMATCH");
      return true;
    }
  );
});

test("createSgxDcapQuoteValidator with no options performs structural validation only", async () => {
  const quoteHex = buildSampleQuoteHex();
  const validator = createSgxDcapQuoteValidator();

  await assert.doesNotReject(() =>
    validator.validate({
      providerType: "sgx-dcap",
      measurement: SAMPLE_MRENCLAVE,
      quoteFormat: "sgx-dcap-v3",
      sessionPublicKey: "spk",
      quote: quoteHex
    })
  );
});

test("buildMockSgxDcapQuote produces a quote that round-trips through parseSgxDcapQuote", () => {
  const reportData = computeExpectedReportData("0xtest:0", "f".repeat(64), "e".repeat(64));
  const mrEnclave = "ab".repeat(32);
  const quoteHex = buildMockSgxDcapQuote({ mrEnclave, reportData });
  const parsed = parseSgxDcapQuote(quoteHex);

  assert.equal(parsed.mrEnclave, mrEnclave);
  assert.ok(parsed.reportData.equals(reportData));
  assert.equal(parsed.version, 3);
  assert.equal(parsed.teeType, 0);
});
