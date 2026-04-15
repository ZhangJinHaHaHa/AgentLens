import { createHash } from "node:crypto";

import type { AttestationQuoteValidator } from "./attestationQuoteValidator";

/**
 * SGX DCAP v3 Quote binary layout (all offsets in bytes from quote start):
 *
 * Header (48 bytes):
 *   [0..1]    version (uint16 LE) = 3
 *   [2..3]    att_key_type (uint16 LE) = 2 (ECDSA-256-with-P-256)
 *   [4..7]    tee_type (uint32 LE) = 0 (SGX)
 *   [8..9]    qe_svn
 *   [10..11]  pce_svn
 *   [12..27]  qe_vendor_id
 *   [28..47]  user_data
 *
 * Report Body (384 bytes, offset 48):
 *   [48..63]    cpu_svn
 *   [64..67]    misc_select
 *   [68..79]    reserved1
 *   [80..95]    isv_ext_prod_id
 *   [96..111]   attributes
 *   [112..143]  mr_enclave (MRENCLAVE, 32 bytes)
 *   [144..175]  reserved2
 *   [176..207]  mr_signer (MRSIGNER, 32 bytes)
 *   [208..239]  reserved3
 *   [240..303]  config_id
 *   [304..305]  isv_prod_id
 *   [306..307]  isv_svn
 *   [308..309]  config_svn
 *   [310..351]  reserved4
 *   [352..367]  isv_family_id
 *   [368..431]  report_data (64 bytes)
 *
 * Auth Data (variable, offset 432):
 *   [432..435]  auth_data_size (uint32 LE)
 *   [436..]     ECDSA signature + certification data
 */

const QUOTE_HEADER_SIZE = 48;
const REPORT_BODY_SIZE = 384;
const MIN_QUOTE_SIZE = QUOTE_HEADER_SIZE + REPORT_BODY_SIZE;

const MRENCLAVE_OFFSET = 112;
const MRENCLAVE_SIZE = 32;
const REPORT_DATA_OFFSET = 368;
const REPORT_DATA_SIZE = 64;

export type SgxDcapValidationErrorCode =
  | "INVALID_QUOTE_HEX"
  | "QUOTE_TOO_SHORT"
  | "INVALID_QUOTE_VERSION"
  | "INVALID_TEE_TYPE"
  | "MRENCLAVE_MISMATCH"
  | "REPORT_DATA_MISMATCH";

export class SgxDcapValidationError extends Error {
  code: SgxDcapValidationErrorCode;

  constructor(code: SgxDcapValidationErrorCode, message: string) {
    super(message);
    this.name = "SgxDcapValidationError";
    this.code = code;
  }
}

export interface ParsedSgxDcapQuote {
  version: number;
  attKeyType: number;
  teeType: number;
  mrEnclave: string;
  mrSigner: string;
  reportData: Buffer;
}

export function parseSgxDcapQuote(quoteHex: string): ParsedSgxDcapQuote {
  if (!/^[0-9a-fA-F]+$/u.test(quoteHex)) {
    throw new SgxDcapValidationError(
      "INVALID_QUOTE_HEX",
      "quote is not valid hex"
    );
  }

  const quoteBytes = Buffer.from(quoteHex, "hex");

  if (quoteBytes.length < MIN_QUOTE_SIZE) {
    throw new SgxDcapValidationError(
      "QUOTE_TOO_SHORT",
      `quote is ${quoteBytes.length} bytes, minimum is ${MIN_QUOTE_SIZE}`
    );
  }

  const version = quoteBytes.readUInt16LE(0);
  if (version !== 3) {
    throw new SgxDcapValidationError(
      "INVALID_QUOTE_VERSION",
      `expected quote version 3, got ${version}`
    );
  }

  const teeType = quoteBytes.readUInt32LE(4);
  if (teeType !== 0) {
    throw new SgxDcapValidationError(
      "INVALID_TEE_TYPE",
      `expected TEE type 0 (SGX), got ${teeType}`
    );
  }

  return {
    version,
    attKeyType: quoteBytes.readUInt16LE(2),
    teeType,
    mrEnclave: quoteBytes
      .subarray(MRENCLAVE_OFFSET, MRENCLAVE_OFFSET + MRENCLAVE_SIZE)
      .toString("hex"),
    mrSigner: quoteBytes
      .subarray(176, 176 + 32)
      .toString("hex"),
    reportData: Buffer.from(
      quoteBytes.subarray(REPORT_DATA_OFFSET, REPORT_DATA_OFFSET + REPORT_DATA_SIZE)
    ),
  };
}

export function computeExpectedReportData(
  eventKey: string,
  manifestHash: string,
  evidenceRoot: string
): Buffer {
  const payload = eventKey + manifestHash + evidenceRoot;
  const digest = createHash("sha256").update(payload).digest();
  const reportData = Buffer.alloc(REPORT_DATA_SIZE);
  digest.copy(reportData, 0, 0, 32);
  return reportData;
}

export interface SgxDcapQuoteValidatorOptions {
  expectedMrEnclave?: string;
  expectedEventKey?: string;
  expectedManifestHash?: string;
  expectedEvidenceRoot?: string;
}

export function createSgxDcapQuoteValidator(
  options: SgxDcapQuoteValidatorOptions = {}
): AttestationQuoteValidator {
  return {
    async validate(input) {
      const parsed = parseSgxDcapQuote(input.quote);

      if (
        options.expectedMrEnclave &&
        parsed.mrEnclave !== options.expectedMrEnclave.toLowerCase()
      ) {
        throw new SgxDcapValidationError(
          "MRENCLAVE_MISMATCH",
          `MRENCLAVE mismatch: expected ${options.expectedMrEnclave}, got ${parsed.mrEnclave}`
        );
      }

      if (
        options.expectedEventKey &&
        options.expectedManifestHash &&
        options.expectedEvidenceRoot
      ) {
        const expectedReportData = computeExpectedReportData(
          options.expectedEventKey,
          options.expectedManifestHash,
          options.expectedEvidenceRoot
        );

        if (!parsed.reportData.equals(expectedReportData)) {
          throw new SgxDcapValidationError(
            "REPORT_DATA_MISMATCH",
            "report_data does not match expected sha256(eventKey + manifestHash + evidenceRoot)"
          );
        }
      }
    }
  };
}

export function buildMockSgxDcapQuote(options: {
  mrEnclave: string;
  reportData: Buffer;
}): string {
  const quoteBuffer = Buffer.alloc(MIN_QUOTE_SIZE + 4);

  // Header
  quoteBuffer.writeUInt16LE(3, 0);    // version = 3
  quoteBuffer.writeUInt16LE(2, 2);    // att_key_type = ECDSA-256
  quoteBuffer.writeUInt32LE(0, 4);    // tee_type = SGX

  // Report body: MRENCLAVE
  const mrEnclaveBytes = Buffer.from(options.mrEnclave, "hex");
  mrEnclaveBytes.copy(quoteBuffer, MRENCLAVE_OFFSET, 0, MRENCLAVE_SIZE);

  // Report body: report_data
  options.reportData.copy(quoteBuffer, REPORT_DATA_OFFSET, 0, REPORT_DATA_SIZE);

  // Auth data size = 0
  quoteBuffer.writeUInt32LE(0, MIN_QUOTE_SIZE);

  return quoteBuffer.toString("hex");
}
