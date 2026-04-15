import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { computeAuditReportHash } from "./buildAuditReport";
import {
  buildPersistedReportEventKeyFragment,
  validatePersistedReportEventKey
} from "./persistAuditReport";

export interface ReadPersistedAuditReportOptions {
  eventKey: string;
  baseDir?: string;
}

export type ReadPersistedAuditReportResult =
  | {
      status: "verified";
      eventKey: string;
      reportFilePath: string;
      reportHash: string;
    }
  | {
      status: "not_found";
      eventKey: string;
    }
  | {
      status: "hash_mismatch";
      eventKey: string;
      reportFilePath: string;
      expectedReportHash: string;
      actualReportHash: string;
    }
  | {
      status: "conflict";
      eventKey: string;
      matches: string[];
    };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function readPersistedAuditReport(
  options: ReadPersistedAuditReportOptions
): Promise<ReadPersistedAuditReportResult> {
  validatePersistedReportEventKey(options.eventKey);

  const baseDir = path.resolve(options.baseDir ?? path.join(process.cwd(), ".runtime", "reports"));
  const eventKeyFragment = buildPersistedReportEventKeyFragment(options.eventKey);
  const expectedNamePattern = new RegExp(
    `^\\d+-${escapeRegex(eventKeyFragment)}-([0-9a-fA-F]{64})\\.json$`
  );

  let entries: string[];
  try {
    entries = await readdir(baseDir, { withFileTypes: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        status: "not_found",
        eventKey: options.eventKey
      };
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
        filePath: path.join(baseDir, entry),
        expectedReportHash: match[1]
      };
    })
    .filter((entry): entry is { filePath: string; expectedReportHash: string } => entry !== undefined)
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  if (matches.length === 0) {
    return {
      status: "not_found",
      eventKey: options.eventKey
    };
  }

  if (matches.length > 1) {
    return {
      status: "conflict",
      eventKey: options.eventKey,
      matches: matches.map((match) => match.filePath)
    };
  }

  const match = matches[0];
  const reportJson = await readFile(match.filePath, "utf8");
  const actualReportHash = computeAuditReportHash(reportJson);

  if (actualReportHash !== match.expectedReportHash.toLowerCase()) {
    return {
      status: "hash_mismatch",
      eventKey: options.eventKey,
      reportFilePath: match.filePath,
      expectedReportHash: match.expectedReportHash,
      actualReportHash
    };
  }

  return {
    status: "verified",
    eventKey: options.eventKey,
    reportFilePath: match.filePath,
    reportHash: match.expectedReportHash
  };
}
