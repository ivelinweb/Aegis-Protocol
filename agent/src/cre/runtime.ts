import { ethers } from "ethers";
import { LOGGER_RUNTIME_ABI, VAULT_RUNTIME_ABI } from "./abis";
import type { CreWorkflowConfig } from "./config";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface CreRuntimeSnapshot {
  liveRead: boolean;
  networkName: string;
  chainId: number | null;
  blockNumber: number | null;
  totalEthDeposited: string | null;
  totalActionsExecuted: number | null;
  totalValueProtected: string | null;
  totalDecisions: number | null;
  totalThreats: number | null;
  totalProtections: number | null;
  latestRiskOverall: number | null;
  notes: string[];
}

function formatNetworkName(name: string, chainId: number | null): string {
  if (name && name !== "unknown") {
    return name;
  }
  if (chainId === 9991) {
    return "Tenderly myEth Mainnet";
  }
  if (chainId === 1) {
    return "Ethereum Mainnet";
  }
  return chainId ? `chain-${chainId}` : "unresolved-network";
}

export async function loadCreRuntimeSnapshot(config: CreWorkflowConfig): Promise<CreRuntimeSnapshot> {
  const notes: string[] = [];
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  const [networkResult, blockResult] = await Promise.allSettled([
    provider.getNetwork(),
    provider.getBlockNumber(),
  ]);

  const network = networkResult.status === "fulfilled" ? networkResult.value : null;
  const blockNumber = blockResult.status === "fulfilled" ? blockResult.value : null;

  if (networkResult.status === "rejected") {
    notes.push(`network probe failed: ${networkResult.reason instanceof Error ? networkResult.reason.message : "unknown error"}`);
  }
  if (blockResult.status === "rejected") {
    notes.push(`block probe failed: ${blockResult.reason instanceof Error ? blockResult.reason.message : "unknown error"}`);
  }

  let totalEthDeposited: string | null = null;
  let totalActionsExecuted: number | null = null;
  let totalValueProtected: string | null = null;
  let totalDecisions: number | null = null;
  let totalThreats: number | null = null;
  let totalProtections: number | null = null;
  let latestRiskOverall: number | null = null;

  const vault = new ethers.Contract(config.vaultAddress, VAULT_RUNTIME_ABI, provider);
  const logger = new ethers.Contract(config.loggerAddress, LOGGER_RUNTIME_ABI, provider);
  const runtimeReads: Promise<unknown>[] = [vault.getVaultStats(), logger.getStats()];
  const readLatestRisk = config.referenceAddress !== ZERO_ADDRESS;

  if (readLatestRisk) {
    runtimeReads.push(logger.getLatestRisk(config.referenceAddress));
  } else {
    notes.push("REFERENCE_ADDRESS not set — skipping latest risk read");
  }

  const readResults = await Promise.allSettled(runtimeReads);

  const vaultStatsResult = readResults[0];
  if (vaultStatsResult?.status === "fulfilled") {
    const stats = vaultStatsResult.value as readonly [bigint, bigint, bigint];
    totalEthDeposited = ethers.formatEther(stats[0]);
    totalActionsExecuted = Number(stats[1]);
    totalValueProtected = ethers.formatEther(stats[2]);
  } else if (vaultStatsResult?.status === "rejected") {
    notes.push(`vault read failed: ${vaultStatsResult.reason instanceof Error ? vaultStatsResult.reason.message : "unknown error"}`);
  }

  const loggerStatsResult = readResults[1];
  if (loggerStatsResult?.status === "fulfilled") {
    const stats = loggerStatsResult.value as readonly [bigint, bigint, bigint];
    totalDecisions = Number(stats[0]);
    totalThreats = Number(stats[1]);
    totalProtections = Number(stats[2]);
  } else if (loggerStatsResult?.status === "rejected") {
    notes.push(`logger read failed: ${loggerStatsResult.reason instanceof Error ? loggerStatsResult.reason.message : "unknown error"}`);
  }

  if (readLatestRisk) {
    const latestRiskResult = readResults[2];
    if (latestRiskResult?.status === "fulfilled") {
      const latestRisk = latestRiskResult.value as { timestamp?: bigint; overallRisk?: bigint };
      if (Number(latestRisk.timestamp ?? 0n) > 0) {
        latestRiskOverall = Number(latestRisk.overallRisk ?? 0n);
      }
    } else if (latestRiskResult?.status === "rejected") {
      notes.push(`latest risk read failed: ${latestRiskResult.reason instanceof Error ? latestRiskResult.reason.message : "unknown error"}`);
    }
  }

  return {
    liveRead: [networkResult, blockResult, ...readResults].some((result) => result.status === "fulfilled"),
    networkName: formatNetworkName(network?.name ?? "unknown", network ? Number(network.chainId) : null),
    chainId: network ? Number(network.chainId) : null,
    blockNumber,
    totalEthDeposited,
    totalActionsExecuted,
    totalValueProtected,
    totalDecisions,
    totalThreats,
    totalProtections,
    latestRiskOverall,
    notes,
  };
}