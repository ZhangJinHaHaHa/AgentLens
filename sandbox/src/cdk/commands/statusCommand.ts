import { loadCdkConfig } from "../cdkConfig";
import { readAgentProfile, readLatestAuditReport, readReputation } from "../chain/cdkRegistryReader";
import { auditStatusLabel } from "../cdkTypes";
import type { ReputationInfo } from "../cdkTypes";
import {
  printHeader,
  printKeyValue,
  printError,
  printInfo,
  bold,
  green,
  red,
  yellow,
  dim
} from "../util/formatOutput";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatTimestamp(ts: number): string {
  if (ts === 0) return dim("—");
  return new Date(ts * 1000).toISOString();
}

function formatEth(wei: bigint): string {
  const ethStr = (Number(wei) / 1e18).toFixed(6);
  return `${ethStr} ETH`;
}

export interface StatusCommandOptions {
  tokenId: string;
  watch: boolean;
  fetchImpl?: typeof fetch;
}

export async function runStatusCommand(options: StatusCommandOptions): Promise<void> {
  const config = loadCdkConfig();
  const tokenId = BigInt(options.tokenId);

  const readerOpts = {
    rpcUrl: config.rpcUrl,
    contractAddress: config.registryAddress,
    fetchImpl: options.fetchImpl
  };

  const printStatus = async (): Promise<number> => {
    const profile = await readAgentProfile(readerOpts, tokenId);
    const report = await readLatestAuditReport(readerOpts, tokenId);
    let reputation: ReputationInfo | null = null;
    try {
      reputation = await readReputation(readerOpts, tokenId);
    } catch {
      // V3 contract may not be deployed; skip reputation display
    }

    printHeader(`Agent #${tokenId}`);
    printKeyValue("Name", profile.agentName);
    printKeyValue("Developer", profile.developer);
    printKeyValue("Bond", formatEth(profile.totalBond));
    printKeyValue("Blacklisted", profile.blacklisted ? red("Yes") : green("No"));
    printKeyValue("Created", formatTimestamp(profile.createdAt));
    printKeyValue("Last Audit", formatTimestamp(profile.lastAuditAt));
    printKeyValue("Audit Count", String(profile.auditCount));

    if (reputation !== null) {
      printHeader("Reputation (MDDRM)");
      printKeyValue("Score", `${reputation.currentReputationScore} / 10000`);
      printKeyValue("Level", formatReputationLevel(reputation.currentReputationScore));
      printKeyValue("Delta", reputation.reputationDelta >= 0 ? green(`+${reputation.reputationDelta}`) : red(String(reputation.reputationDelta)));
      printKeyValue("Appeals", `${reputation.successfulAppeals} approved / ${reputation.failedAppeals} rejected`);
      if (reputation.lastReputationUpdateAt > 0) {
        printKeyValue("Last Updated", formatTimestamp(reputation.lastReputationUpdateAt));
      }
    }

    if (report.auditId > 0) {
      printHeader("Latest Audit Report");
      printKeyValue("Audit ID", String(report.auditId));
      printKeyValue("Score", `${report.auditScore}/100`);
      printKeyValue("Status", formatStatusColored(report.status));
      printKeyValue("Timestamp", formatTimestamp(report.timestamp));
      printKeyValue("Manifest URL", report.manifestUrl);
      printKeyValue("Report CID", report.reportCID || dim("—"));
      printKeyValue("Manifest Hash", report.manifestHash);
      printKeyValue("Report Hash", report.reportHash);

      if (report.evidenceRoot) {
        printKeyValue("Evidence Root", report.evidenceRoot);
      }
      if (report.attestationHash) {
        printKeyValue("Attestation", report.attestationHash);
      }
      if (report.appealRequested) {
        printKeyValue("Appeal", report.appealApproved ? green("Approved") : yellow("Requested"));
      }

      const ds = report.dimensionalScores;
      printHeader("Dimensional Scores");
      printKeyValue("Security", String(ds.security));
      printKeyValue("Task Execution", String(ds.taskExecution));
      printKeyValue("Cognitive", String(ds.cognitive));
      printKeyValue("Environment", String(ds.environment));
      printKeyValue("Engineering", String(ds.engineering));
      printKeyValue("Compliance", String(ds.compliance));
    } else {
      printInfo("No audit report yet.");
    }

    process.stdout.write("\n");
    return report.status;
  };

  const status = await printStatus();

  if (options.watch && status === 0) {
    printInfo("Watching for audit completion (polling every 10s)...\n");
    for (;;) {
      await sleep(10_000);
      const currentStatus = await printStatus();
      if (currentStatus !== 0) {
        break;
      }
    }
  }
}

function formatReputationLevel(score: number): string {
  if (score >= 8000) return green("Excellent");
  if (score >= 5000) return green("Good");
  if (score >= 2000) return yellow("Fair");
  if (score >= 500) return yellow("Poor");
  return red("Bad");
}

function formatStatusColored(status: number): string {
  const label = auditStatusLabel(status);
  switch (status) {
    case 1:
      return green(label);
    case 2:
      return red(label);
    case 3:
      return red(bold(label));
    default:
      return yellow(label);
  }
}
