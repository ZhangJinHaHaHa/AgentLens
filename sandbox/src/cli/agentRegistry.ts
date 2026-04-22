import {
  readListenerRuntimeConfigFromEnv,
  type ListenerRuntimeConfig
} from "../listener/createListenerRuntime";
import {
  readAgentProfile as defaultReadAgentProfile,
  type AgentProfileOnChain
} from "../listener/readAgentProfile";
import {
  readLatestAuditReport as defaultReadLatestAuditReport,
  type LatestAuditReport
} from "../listener/readLatestAuditReport";
import {
  readAuditReportByIndex as defaultReadAuditReportByIndex,
  type AuditReportByIndex
} from "../listener/readAuditReportByIndex";
import { normalizeContractReadError } from "../listener/normalizeContractReadError";
import { runAttestationVerifyCli as defaultRunAttestationVerifyCli } from "./attestationVerify";
import { runEvidenceVerifyCli as defaultRunEvidenceVerifyCli } from "./evidenceVerify";
import { runReportVerifyCli as defaultRunReportVerifyCli } from "./reportVerify";

type ListenerEnv = NodeJS.ProcessEnv | Record<string, string | undefined>;

type VerifyKind = "report" | "evidence" | "attestation";

const DEFAULT_SEARCH_BATCH_SIZE = 10;
const DEFAULT_START_TOKEN_ID = 1;
const DEFAULT_MAX_CONSECUTIVE_NOT_FOUND = 5;
const DEFAULT_HISTORY_OFFSET = 0;
const DEFAULT_HISTORY_LIMIT = 10;

export interface AgentRegistryGetReportArgs {
  tokenId: bigint;
  auditId?: number;
}

export interface AgentRegistryHistoryArgs {
  tokenId: bigint;
  offset: number;
  limit: number;
}

export interface AgentRegistrySearchArgs {
  startTokenId: number;
  batchSize: number;
  maxConsecutiveNotFound: number;
  agentNameContains?: string;
  status?: number;
  minScore?: number;
}

export interface AgentRegistryVerifyArgs {
  kind: VerifyKind;
  forwardedArgv: string[];
}

export interface AgentRegistryCliDependencies {
  readConfig?: (env: ListenerEnv) => ListenerRuntimeConfig;
  readAgentProfile?: (options: {
    rpcUrl: string;
    contractAddress: string;
    tokenId: bigint;
    fetchImpl?: typeof fetch;
  }) => Promise<AgentProfileOnChain>;
  readLatestAuditReport?: (options: {
    rpcUrl: string;
    contractAddress: string;
    tokenId: bigint;
    fetchImpl?: typeof fetch;
  }) => Promise<LatestAuditReport>;
  readAuditReportByIndex?: (options: {
    rpcUrl: string;
    contractAddress: string;
    tokenId: bigint;
    index: number;
    fetchImpl?: typeof fetch;
  }) => Promise<AuditReportByIndex>;
  runReportVerifyCli?: (argv: string[], env: ListenerEnv) => Promise<number>;
  runEvidenceVerifyCli?: (argv: string[], env: ListenerEnv) => Promise<number>;
  runAttestationVerifyCli?: (argv: string[], env: ListenerEnv) => Promise<number>;
  writeStdout?: (line: string) => void;
}

interface SearchAgentSummary {
  tokenId: string;
  agentName: string;
  developer: string;
  totalBond: string;
  blacklisted: boolean;
  auditCount: number;
  latestStatus: number | null;
  latestScore: number | null;
}

interface AgentRegistryGetReportResult {
  status: "ok" | "not_found" | "audit_not_found";
  tokenId: string;
  auditId?: number;
  profile?: {
    developer: string;
    agentName: string;
    tokenId: string;
    totalBond: string;
    blacklisted: boolean;
    createdAt: number;
    lastAuditAt: number;
    auditCount: number;
  };
  latestAuditReport?: LatestAuditReport | null;
  auditReport?: AuditReportByIndex;
}

interface HistoryAuditEntry extends AuditReportByIndex {
  index: number;
}

interface AgentRegistryHistoryResult {
  status: "ok" | "not_found";
  tokenId: string;
  profile?: {
    developer: string;
    agentName: string;
    tokenId: string;
    totalBond: string;
    blacklisted: boolean;
    createdAt: number;
    lastAuditAt: number;
    auditCount: number;
  };
  paging?: {
    offset: number;
    limit: number;
    total: number;
    returned: number;
    hasMore: boolean;
  };
  audits?: HistoryAuditEntry[];
}

interface AgentRegistrySearchResult {
  status: "ok";
  filters: {
    startTokenId: number;
    batchSize: number;
    maxConsecutiveNotFound: number;
    agentNameContains: string | null;
    status: number | null;
    minScore: number | null;
  };
  agents: SearchAgentSummary[];
  nextScanTokenId: string;
  consecutiveNotFound: number;
  hasMore: boolean;
}

function writeJsonLine(writeStdout: (line: string) => void, payload: unknown): void {
  writeStdout(`${JSON.stringify(payload)}\n`);
}

function parseRequiredIntegerArg(argv: string[], flag: string, usage: string): number {
  const argIndex = argv.indexOf(flag);
  const value = argIndex >= 0 ? argv[argIndex + 1] : undefined;

  if (!value || !/^\d+$/u.test(value)) {
    throw new Error(usage);
  }

  return Number.parseInt(value, 10);
}

function parseOptionalIntegerArg(argv: string[], flag: string): number | undefined {
  const argIndex = argv.indexOf(flag);
  const value = argIndex >= 0 ? argv[argIndex + 1] : undefined;

  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    throw new Error(`${flag} must be a non-negative integer`);
  }

  return Number.parseInt(value, 10);
}

function parseOptionalStringArg(argv: string[], flag: string): string | undefined {
  const argIndex = argv.indexOf(flag);
  const value = argIndex >= 0 ? argv[argIndex + 1] : undefined;
  return value || undefined;
}

export function parseAgentRegistryGetReportArgs(argv: string[]): AgentRegistryGetReportArgs {
  const tokenId = parseRequiredIntegerArg(
    argv,
    "--token-id",
    "Usage: npm run run:agent:get-report -- --token-id <tokenId> [--audit-id <auditId>]"
  );
  const auditId = parseOptionalIntegerArg(argv, "--audit-id");

  if (auditId !== undefined && auditId < 1) {
    throw new Error("--audit-id must be at least 1");
  }

  return {
    tokenId: BigInt(tokenId),
    ...(auditId !== undefined ? { auditId } : {})
  };
}

export function parseAgentRegistryHistoryArgs(argv: string[]): AgentRegistryHistoryArgs {
  const tokenId = parseRequiredIntegerArg(
    argv,
    "--token-id",
    "Usage: npm run run:agent:registry -- history --token-id <tokenId> [--offset <offset>] [--limit <limit>]"
  );
  const offset = parseOptionalIntegerArg(argv, "--offset") ?? DEFAULT_HISTORY_OFFSET;
  const limit = parseOptionalIntegerArg(argv, "--limit") ?? DEFAULT_HISTORY_LIMIT;

  if (offset < 0) {
    throw new Error("--offset must be at least 0");
  }

  if (limit < 1) {
    throw new Error("--limit must be at least 1");
  }

  return {
    tokenId: BigInt(tokenId),
    offset,
    limit
  };
}

export function parseAgentRegistrySearchArgs(argv: string[]): AgentRegistrySearchArgs {
  const startTokenId = parseOptionalIntegerArg(argv, "--start-token-id") ?? DEFAULT_START_TOKEN_ID;
  const batchSize = parseOptionalIntegerArg(argv, "--batch-size") ?? DEFAULT_SEARCH_BATCH_SIZE;
  const maxConsecutiveNotFound =
    parseOptionalIntegerArg(argv, "--max-consecutive-not-found") ??
    DEFAULT_MAX_CONSECUTIVE_NOT_FOUND;
  const status = parseOptionalIntegerArg(argv, "--status");
  const minScore = parseOptionalIntegerArg(argv, "--min-score");
  const agentNameContains = parseOptionalStringArg(argv, "--agent-name-contains");

  if (startTokenId < 1) {
    throw new Error("--start-token-id must be at least 1");
  }

  if (batchSize < 1) {
    throw new Error("--batch-size must be at least 1");
  }

  if (maxConsecutiveNotFound < 1) {
    throw new Error("--max-consecutive-not-found must be at least 1");
  }

  return {
    startTokenId,
    batchSize,
    maxConsecutiveNotFound,
    ...(agentNameContains ? { agentNameContains } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(minScore !== undefined ? { minScore } : {})
  };
}

export function parseAgentRegistryVerifyArgs(argv: string[]): AgentRegistryVerifyArgs {
  const kind = argv[0];

  if (kind !== "report" && kind !== "evidence" && kind !== "attestation") {
    throw new Error(
      "Usage: npm run run:agent:verify -- <report|evidence|attestation> --event-key <transactionHash>:<logIndex> [--state-dir /path/to/listener-state]"
    );
  }

  return {
    kind,
    forwardedArgv: argv.slice(1)
  };
}

function serializeAgentProfile(profile: AgentProfileOnChain): AgentRegistryGetReportResult["profile"] {
  return {
    developer: profile.developer,
    agentName: profile.agentName,
    tokenId: profile.tokenId.toString(),
    totalBond: profile.totalBond.toString(),
    blacklisted: profile.blacklisted,
    createdAt: profile.createdAt,
    lastAuditAt: profile.lastAuditAt,
    auditCount: profile.auditCount
  };
}

function buildSearchAgentSummary(
  profile: AgentProfileOnChain,
  latestAuditReport: LatestAuditReport | null
): SearchAgentSummary {
  return {
    tokenId: profile.tokenId.toString(),
    agentName: profile.agentName,
    developer: profile.developer,
    totalBond: profile.totalBond.toString(),
    blacklisted: profile.blacklisted,
    auditCount: profile.auditCount,
    latestStatus: latestAuditReport?.status ?? null,
    latestScore: latestAuditReport?.auditScore ?? null
  };
}

function matchesSearchFilters(
  agent: SearchAgentSummary,
  args: AgentRegistrySearchArgs
): boolean {
  if (
    args.agentNameContains &&
    !agent.agentName.toLowerCase().includes(args.agentNameContains.toLowerCase())
  ) {
    return false;
  }

  if (args.status !== undefined && agent.latestStatus !== args.status) {
    return false;
  }

  if (args.minScore !== undefined && (agent.latestScore === null || agent.latestScore < args.minScore)) {
    return false;
  }

  return true;
}

async function findAuditReportByAuditId(
  tokenId: bigint,
  auditCount: number,
  auditId: number,
  config: ListenerRuntimeConfig,
  dependencies: AgentRegistryCliDependencies
): Promise<AuditReportByIndex | null> {
  const reader = dependencies.readAuditReportByIndex ?? defaultReadAuditReportByIndex;

  for (let index = 0; index < auditCount; index += 1) {
    const report = await reader({
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      tokenId,
      index
    });

    if (report.auditId === auditId) {
      return report;
    }
  }

  return null;
}

async function readLatestAuditReportOrNull(
  tokenId: bigint,
  config: ListenerRuntimeConfig,
  dependencies: AgentRegistryCliDependencies
): Promise<LatestAuditReport | null> {
  try {
    return await (dependencies.readLatestAuditReport ?? defaultReadLatestAuditReport)({
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      tokenId
    });
  } catch (error) {
    if (normalizeContractReadError(error) === "NO_AUDIT_RECORD") {
      return null;
    }

    throw error;
  }
}

export async function runAgentRegistryGetReportCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: AgentRegistryCliDependencies = {}
): Promise<number> {
  const args = parseAgentRegistryGetReportArgs(argv);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));
  const config = (dependencies.readConfig ?? readListenerRuntimeConfigFromEnv)(env);

  try {
    const profile = await (dependencies.readAgentProfile ?? defaultReadAgentProfile)({
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      tokenId: args.tokenId
    });

    if (args.auditId !== undefined) {
      const auditReport = await findAuditReportByAuditId(
        args.tokenId,
        profile.auditCount,
        args.auditId,
        config,
        dependencies
      );

      if (auditReport === null) {
        const result: AgentRegistryGetReportResult = {
          status: "audit_not_found",
          tokenId: args.tokenId.toString(),
          auditId: args.auditId,
          profile: serializeAgentProfile(profile)
        };
        writeJsonLine(writeStdout, result);
        return 1;
      }

      const result: AgentRegistryGetReportResult = {
        status: "ok",
        tokenId: args.tokenId.toString(),
        auditId: args.auditId,
        profile: serializeAgentProfile(profile),
        auditReport
      };

      writeJsonLine(writeStdout, result);
      return 0;
    }

    const latestAuditReport = await readLatestAuditReportOrNull(args.tokenId, config, dependencies);
    const result: AgentRegistryGetReportResult = {
      status: "ok",
      tokenId: args.tokenId.toString(),
      profile: serializeAgentProfile(profile),
      latestAuditReport
    };

    writeJsonLine(writeStdout, result);
    return 0;
  } catch (error) {
    if (normalizeContractReadError(error) === "TOKEN_NOT_FOUND") {
      const result: AgentRegistryGetReportResult = {
        status: "not_found",
        tokenId: args.tokenId.toString(),
        ...(args.auditId !== undefined ? { auditId: args.auditId } : {})
      };
      writeJsonLine(writeStdout, result);
      return 1;
    }

    throw error;
  }
}

export async function runAgentRegistryHistoryCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: AgentRegistryCliDependencies = {}
): Promise<number> {
  const args = parseAgentRegistryHistoryArgs(argv);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));
  const config = (dependencies.readConfig ?? readListenerRuntimeConfigFromEnv)(env);

  let profile: AgentProfileOnChain;
  try {
    profile = await (dependencies.readAgentProfile ?? defaultReadAgentProfile)({
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      tokenId: args.tokenId
    });
  } catch (error) {
    if (normalizeContractReadError(error) === "TOKEN_NOT_FOUND") {
      const result: AgentRegistryHistoryResult = {
        status: "not_found",
        tokenId: args.tokenId.toString()
      };
      writeJsonLine(writeStdout, result);
      return 1;
    }

    throw error;
  }

  const total = profile.auditCount;
  const reader = dependencies.readAuditReportByIndex ?? defaultReadAuditReportByIndex;

  // Latest-first: highest index is most recent. Skip `offset` newest, then take `limit`.
  const indicesToRead: number[] = [];
  for (let i = 0; i < args.limit; i += 1) {
    const targetIndex = total - 1 - args.offset - i;
    if (targetIndex < 0) {
      break;
    }
    indicesToRead.push(targetIndex);
  }

  const audits: HistoryAuditEntry[] = [];
  for (const index of indicesToRead) {
    const report = await reader({
      rpcUrl: config.rpcUrl,
      contractAddress: config.contractAddress,
      tokenId: args.tokenId,
      index
    });
    audits.push({ index, ...report });
  }

  const result: AgentRegistryHistoryResult = {
    status: "ok",
    tokenId: args.tokenId.toString(),
    profile: serializeAgentProfile(profile),
    paging: {
      offset: args.offset,
      limit: args.limit,
      total,
      returned: audits.length,
      hasMore: args.offset + audits.length < total
    },
    audits
  };

  writeJsonLine(writeStdout, result);
  return 0;
}

export async function runAgentRegistrySearchCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: AgentRegistryCliDependencies = {}
): Promise<number> {
  const args = parseAgentRegistrySearchArgs(argv);
  const writeStdout = dependencies.writeStdout ?? ((line: string) => process.stdout.write(line));
  const config = (dependencies.readConfig ?? readListenerRuntimeConfigFromEnv)(env);
  const agents: SearchAgentSummary[] = [];
  let consecutiveNotFound = 0;
  let currentTokenId = args.startTokenId;

  for (let i = 0; i < args.batchSize; i += 1) {
    const tokenId = BigInt(currentTokenId);

    try {
      const profile = await (dependencies.readAgentProfile ?? defaultReadAgentProfile)({
        rpcUrl: config.rpcUrl,
        contractAddress: config.contractAddress,
        tokenId
      });
      const latestAuditReport = await readLatestAuditReportOrNull(tokenId, config, dependencies);
      const agent = buildSearchAgentSummary(profile, latestAuditReport);

      if (matchesSearchFilters(agent, args)) {
        agents.push(agent);
      }

      consecutiveNotFound = 0;
    } catch (error) {
      if (normalizeContractReadError(error) === "TOKEN_NOT_FOUND") {
        consecutiveNotFound += 1;
        if (consecutiveNotFound >= args.maxConsecutiveNotFound) {
          currentTokenId += 1;
          break;
        }
      } else {
        throw error;
      }
    }

    currentTokenId += 1;
  }

  const result: AgentRegistrySearchResult = {
    status: "ok",
    filters: {
      startTokenId: args.startTokenId,
      batchSize: args.batchSize,
      maxConsecutiveNotFound: args.maxConsecutiveNotFound,
      agentNameContains: args.agentNameContains ?? null,
      status: args.status ?? null,
      minScore: args.minScore ?? null
    },
    agents,
    nextScanTokenId: String(currentTokenId),
    consecutiveNotFound,
    hasMore: consecutiveNotFound < args.maxConsecutiveNotFound
  };

  writeJsonLine(writeStdout, result);
  return 0;
}

export async function runAgentRegistryVerifyCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: AgentRegistryCliDependencies = {}
): Promise<number> {
  const args = parseAgentRegistryVerifyArgs(argv);

  if (args.kind === "report") {
    return (dependencies.runReportVerifyCli ?? defaultRunReportVerifyCli)(args.forwardedArgv, env);
  }

  if (args.kind === "evidence") {
    return (dependencies.runEvidenceVerifyCli ?? defaultRunEvidenceVerifyCli)(args.forwardedArgv, env);
  }

  return (dependencies.runAttestationVerifyCli ?? defaultRunAttestationVerifyCli)(args.forwardedArgv, env);
}

export async function runAgentRegistryCli(
  argv: string[],
  env: ListenerEnv,
  dependencies: AgentRegistryCliDependencies = {}
): Promise<number> {
  const command = argv[0];
  const forwardedArgv = argv.slice(1);

  if (command === "get-report") {
    return runAgentRegistryGetReportCli(forwardedArgv, env, dependencies);
  }

  if (command === "search") {
    return runAgentRegistrySearchCli(forwardedArgv, env, dependencies);
  }

  if (command === "history") {
    return runAgentRegistryHistoryCli(forwardedArgv, env, dependencies);
  }

  if (command === "verify") {
    return runAgentRegistryVerifyCli(forwardedArgv, env, dependencies);
  }

  throw new Error(
    "Usage: npm run run:agent:registry -- <get-report|search|history|verify> [...args]"
  );
}

if (require.main === module) {
  void runAgentRegistryCli(process.argv.slice(2), process.env)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
