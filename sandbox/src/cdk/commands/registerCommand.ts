/**
 * `register` 命令编排注册前读链、金额展示、人工确认和 stake 提交；它不校验远端 manifest 内容，也不管理私钥生命周期或交易重试。
 * manifest URL、代理名、可选 ETH 数量及环境配置为输入，终端摘要与 RegisterResult 为可观察输出，确认后会产生真实签名和链上资金副作用。
 * RPC 返回值与用户提供的小数金额处于信任边界；服务费加最低保证金构成下限，未配置密钥、低于下限或用户取消都不得广播交易。
 * 一次调用最多提交一次交易，不能假设失败重试幂等；金额展示沿用现有 ETH 格式，而实际写入始终使用 wei bigint 以维持链协议兼容。
 */
import { Wallet } from "ethers";

import { loadCdkConfig } from "../cdkConfig";
import { readServiceFee, readMinimumBond } from "../chain/cdkRegistryReader";
import { stakeAgent, type CdkRegistryWriterOptions } from "../chain/cdkRegistryWriter";
import { promptConfirm, type PromptUserOptions } from "../util/promptUser";
import {
  printHeader,
  printKeyValue,
  printSuccess,
  printError,
  printInfo,
  bold,
  dim
} from "../util/formatOutput";

function formatEth(wei: bigint): string {
  const ethStr = (Number(wei) / 1e18).toFixed(6);
  return `${ethStr} ETH`;
}

export interface RegisterCommandOptions {
  manifestUrl: string;
  agentName: string;
  stake?: string;
  fetchImpl?: typeof fetch;
  writerOptions?: Partial<CdkRegistryWriterOptions>;
  promptOptions?: PromptUserOptions;
}

export async function runRegisterCommand(options: RegisterCommandOptions): Promise<void> {
  const config = loadCdkConfig();

  if (!config.privateKey) {
    printError("SHENJI_CDK_PRIVATE_KEY environment variable is required for registration.");
    process.exitCode = 1;
    return;
  }

  const readerOpts = {
    rpcUrl: config.rpcUrl,
    contractAddress: config.registryAddress,
    fetchImpl: options.fetchImpl
  };

  const serviceFee = await readServiceFee(readerOpts);
  const minimumBond = await readMinimumBond(readerOpts);
  const minTotal = serviceFee + minimumBond;

  let stakeValue: bigint;
  if (options.stake) {
    stakeValue = BigInt(Math.floor(Number.parseFloat(options.stake) * 1e18));
    if (stakeValue < minTotal) {
      printError(`Stake ${formatEth(stakeValue)} is below minimum required ${formatEth(minTotal)} (serviceFee ${formatEth(serviceFee)} + minimumBond ${formatEth(minimumBond)})`);
      process.exitCode = 1;
      return;
    }
  } else {
    stakeValue = minTotal;
  }

  const wallet = new Wallet(config.privateKey);

  printHeader("Registration Summary");
  printKeyValue("Agent Name", bold(options.agentName));
  printKeyValue("Manifest URL", options.manifestUrl);
  printKeyValue("Service Fee", formatEth(serviceFee));
  printKeyValue("Minimum Bond", formatEth(minimumBond));
  printKeyValue("Total Stake", bold(formatEth(stakeValue)));
  printKeyValue("Wallet", wallet.address);
  printKeyValue("Registry", config.registryAddress);
  printKeyValue("RPC", config.rpcUrl);
  process.stdout.write("\n");

  const confirmed = await promptConfirm("Confirm registration?", options.promptOptions);
  if (!confirmed) {
    printInfo("Registration cancelled.");
    return;
  }

  printInfo("Submitting stake transaction...");

  const result = await stakeAgent(
    {
      config,
      writeClient: options.writerOptions?.writeClient
    },
    options.agentName,
    options.manifestUrl,
    stakeValue
  );

  printSuccess(`Agent registered successfully!`);
  printKeyValue("Token ID", bold(String(result.tokenId)));
  printKeyValue("TX Hash", result.transactionHash);
  printKeyValue("Block", String(result.blockNumber));
  process.stdout.write("\n");
  printInfo(`Track audit progress: ${dim("shenji-cdk status --token-id " + String(result.tokenId))}`);
}
