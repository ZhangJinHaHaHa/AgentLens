export enum AuditStatus {
  Pending = 0,
  Passed = 1,
  Failed = 2,
  Slashed = 3
}

export function auditStatusLabel(status: number): string {
  switch (status) {
    case AuditStatus.Pending:
      return "Pending";
    case AuditStatus.Passed:
      return "Passed";
    case AuditStatus.Failed:
      return "Failed";
    case AuditStatus.Slashed:
      return "Slashed";
    default:
      return `Unknown(${status})`;
  }
}

export interface CdkConfig {
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly registryAddress: string;
  readonly privateKey?: string;
}

export interface AgentProfile {
  readonly developer: string;
  readonly agentName: string;
  readonly tokenId: bigint;
  readonly totalBond: bigint;
  readonly blacklisted: boolean;
  readonly createdAt: number;
  readonly lastAuditAt: number;
  readonly auditCount: number;
}

export interface DimensionalScores {
  readonly security: number;
  readonly taskExecution: number;
  readonly cognitive: number;
  readonly environment: number;
  readonly engineering: number;
  readonly compliance: number;
}

export interface AuditReport {
  readonly auditId: number;
  readonly timestamp: number;
  readonly auditScore: number;
  readonly memoryPeakMb: number;
  readonly cpuAvgMilli: number;
  readonly requestIpCount: number;
  readonly status: number;
  readonly manifestHash: `0x${string}`;
  readonly reportHash: `0x${string}`;
  readonly evidenceRoot?: `0x${string}`;
  readonly attestationHash?: `0x${string}`;
  readonly evidenceCID?: string;
  readonly reportCID: string;
  readonly manifestUrl: string;
  readonly appealRequested: boolean;
  readonly appealApproved: boolean;
  readonly dimensionalScores: DimensionalScores;
}

export interface ReputationInfo {
  readonly successfulAppeals: number;
  readonly failedAppeals: number;
  readonly reputationDelta: number;
  readonly currentReputationScore: number;
  readonly lastReputationUpdateAt: number;
}

export interface RegisterResult {
  readonly tokenId: bigint;
  readonly transactionHash: `0x${string}`;
  readonly blockNumber: number;
}
