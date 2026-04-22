export type ContractReadErrorCode =
  | "TOKEN_NOT_FOUND"
  | "NO_AUDIT_RECORD"
  | "INDEX_OUT_OF_BOUNDS"
  | "UNKNOWN";

export function normalizeContractReadError(error: unknown): ContractReadErrorCode {
  const message = getContractReadErrorMessage(error);

  if (message.includes("TOKEN_NOT_FOUND")) {
    return "TOKEN_NOT_FOUND";
  }

  if (message.includes("NO_AUDIT_RECORD")) {
    return "NO_AUDIT_RECORD";
  }

  if (message.includes("INDEX_OUT_OF_BOUNDS")) {
    return "INDEX_OUT_OF_BOUNDS";
  }

  return "UNKNOWN";
}

export function getContractReadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown contract read error.";
}
