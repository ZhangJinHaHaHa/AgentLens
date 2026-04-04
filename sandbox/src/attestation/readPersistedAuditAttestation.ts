import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { buildPersistedReportEventKeyFragment, validatePersistedReportEventKey } from "../report/persistAuditReport";
import { computeAuditAttestationHash } from "./buildAuditAttestation";
import {
  computeExpectedReportData,
  parseSgxDcapQuote,
  SgxDcapValidationError
} from "./sgxDcapQuoteValidator";

export interface ReadPersistedAuditAttestationOptions {
  eventKey: string;
  baseDir?: string;
  expectedVerifier?: {
    providerType?: string;
    measurement?: string;
    quoteFormat?: string;
  };
  verifyReportDataBinding?: boolean;
}

export type ReadPersistedAuditAttestationResult =
  | {
      status: "verified";
      eventKey: string;
      attestationFilePath: string;
      attestationHash: string;
    }
  | {
      status: "not_found";
      eventKey: string;
    }
  | {
      status: "hash_mismatch";
      eventKey: string;
      attestationFilePath: string;
      expectedAttestationHash: string;
      actualAttestationHash: string;
    }
  | {
      status: "conflict";
      eventKey: string;
      matches: string[];
    }
  | {
      status: "invalid_bundle";
      eventKey: string;
      attestationFilePath: string;
      message: string;
    }
  | {
      status: "verifier_mismatch";
      eventKey: string;
      attestationFilePath: string;
      field: "providerType" | "measurement" | "quoteFormat";
      expected: string;
      actual: string;
    }
  | {
      status: "report_data_mismatch";
      eventKey: string;
      attestationFilePath: string;
      message: string;
    }
  | {
      status: "sgx_quote_invalid";
      eventKey: string;
      attestationFilePath: string;
      message: string;
    };

interface PersistedAuditAttestationBundle {
  schemaVersion: "audit-attestation.v1";
  eventKey: string;
  tokenId: string;
  manifestHash: string;
  evidenceRoot: string;
  verifier: {
    type: string;
    measurement: string;
    quoteFormat: string;
    sessionPublicKey: string;
    quote: string;
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function readPersistedAuditAttestation(
  options: ReadPersistedAuditAttestationOptions
): Promise<ReadPersistedAuditAttestationResult> {
  validatePersistedReportEventKey(options.eventKey);

  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "attestations"));
  const eventKeyFragment = buildPersistedReportEventKeyFragment(options.eventKey);
  const expectedNamePattern = new RegExp(
    `^\\d+-${escapeRegex(eventKeyFragment)}-([0-9a-fA-F]{64})\\.json$`
  );

  let entries;
  try {
    entries = await readdir(baseDir, { withFileTypes: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "not_found", eventKey: options.eventKey };
    }
    throw error;
  }

  const matches = entries
    .map((entry) => {
      const match = entry.match(expectedNamePattern);
      if (!match || !match[1]) {
        return undefined;
      }

      return {
        attestationFilePath: path.join(baseDir, entry),
        expectedAttestationHash: match[1]
      };
    })
    .filter(
      (entry): entry is { attestationFilePath: string; expectedAttestationHash: string } =>
        entry !== undefined
    )
    .sort((left, right) => left.attestationFilePath.localeCompare(right.attestationFilePath));

  if (matches.length === 0) {
    return { status: "not_found", eventKey: options.eventKey };
  }

  if (matches.length > 1) {
    return {
      status: "conflict",
      eventKey: options.eventKey,
      matches: matches.map((match) => match.attestationFilePath)
    };
  }

  const match = matches[0];
  const bundleJson = await readFile(match.attestationFilePath, "utf8");
  const actualAttestationHash = computeAuditAttestationHash(bundleJson);

  if (actualAttestationHash !== match.expectedAttestationHash.toLowerCase()) {
    return {
      status: "hash_mismatch",
      eventKey: options.eventKey,
      attestationFilePath: match.attestationFilePath,
      expectedAttestationHash: match.expectedAttestationHash,
      actualAttestationHash
    };
  }

  const parsed = JSON.parse(bundleJson) as Partial<PersistedAuditAttestationBundle>;
  const verifier = parsed.verifier;
  if (
    parsed.schemaVersion !== "audit-attestation.v1" ||
    typeof parsed.eventKey !== "string" ||
    typeof parsed.tokenId !== "string" ||
    typeof parsed.manifestHash !== "string" ||
    typeof parsed.evidenceRoot !== "string" ||
    !verifier ||
    typeof verifier.type !== "string" ||
    typeof verifier.measurement !== "string" ||
    typeof verifier.quoteFormat !== "string" ||
    typeof verifier.sessionPublicKey !== "string" ||
    typeof verifier.quote !== "string" ||
    verifier.measurement.length === 0 ||
    verifier.quoteFormat.length === 0 ||
    verifier.sessionPublicKey.length === 0 ||
    verifier.quote.length === 0
  ) {
    return {
      status: "invalid_bundle",
      eventKey: options.eventKey,
      attestationFilePath: match.attestationFilePath,
      message: "attestation bundle shape is invalid"
    };
  }

  const expectedVerifier = options.expectedVerifier;
  if (expectedVerifier?.providerType && verifier.type !== expectedVerifier.providerType) {
    return {
      status: "verifier_mismatch",
      eventKey: options.eventKey,
      attestationFilePath: match.attestationFilePath,
      field: "providerType",
      expected: expectedVerifier.providerType,
      actual: verifier.type
    };
  }

  if (expectedVerifier?.measurement && verifier.measurement !== expectedVerifier.measurement) {
    return {
      status: "verifier_mismatch",
      eventKey: options.eventKey,
      attestationFilePath: match.attestationFilePath,
      field: "measurement",
      expected: expectedVerifier.measurement,
      actual: verifier.measurement
    };
  }

  if (expectedVerifier?.quoteFormat && verifier.quoteFormat !== expectedVerifier.quoteFormat) {
    return {
      status: "verifier_mismatch",
      eventKey: options.eventKey,
      attestationFilePath: match.attestationFilePath,
      field: "quoteFormat",
      expected: expectedVerifier.quoteFormat,
      actual: verifier.quoteFormat
    };
  }

  if (options.verifyReportDataBinding && verifier.quoteFormat === "sgx-dcap-v3") {
    try {
      const quote = parseSgxDcapQuote(verifier.quote);
      const expectedReportData = computeExpectedReportData(
        parsed.eventKey as string,
        parsed.manifestHash as string,
        parsed.evidenceRoot as string
      );

      if (!quote.reportData.equals(expectedReportData)) {
        return {
          status: "report_data_mismatch",
          eventKey: options.eventKey,
          attestationFilePath: match.attestationFilePath,
          message: "SGX quote report_data does not match sha256(eventKey + manifestHash + evidenceRoot)"
        };
      }
    } catch (error) {
      if (error instanceof SgxDcapValidationError) {
        return {
          status: "sgx_quote_invalid",
          eventKey: options.eventKey,
          attestationFilePath: match.attestationFilePath,
          message: error.message
        };
      }
      throw error;
    }
  }

  return {
    status: "verified",
    eventKey: options.eventKey,
    attestationFilePath: match.attestationFilePath,
    attestationHash: match.expectedAttestationHash
  };
}
