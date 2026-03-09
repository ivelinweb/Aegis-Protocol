"use client";

import { ethers } from "ethers";
import { LOGGER_ABI, VAULT_ABI } from "./abis";
import { CONTRACTS, EXPLORER_CONFIG, PRIMARY_RPC_URL, TARGET_CHAIN_DECIMAL, ZERO_ADDRESS } from "./constants";

export interface CreRuntimeState {
  liveRead: boolean;
  rpcUrl: string;
  explorerUrl: string;
  chainId: number | null;
  networkName: string;
  blockNumber: number | null;
  totalEthDeposited: string | null;
  totalActionsExecuted: number | null;
  totalValueProtected: string | null;
  totalDecisions: number | null;
  totalThreats: number | null;
  totalProtections: number | null;
  latestRiskOverall: number | null;
  warnings: string[];
}

function getRuntimeRpcUrl(): string {
  return PRIMARY_RPC_URL;
}

function formatNetworkName(name: string, chainId: number | null): string {
  if (name && name !== "unknown") {
    return name;
  }

  if (chainId === TARGET_CHAIN_DECIMAL) {
    return EXPLORER_CONFIG.chainName;
  }

  if (chainId === 1) {
    return "Ethereum Mainnet";
  }

  return chainId ? `chain-${chainId}` : "unresolved-network";
}

export async function loadCreRuntimeState(): Promise<CreRuntimeState> {
  const rpcUrl = getRuntimeRpcUrl();
  const warnings: string[] = [];
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  if (!process.env.NEXT_PUBLIC_TENDERLY_PUBLIC_RPC) {
    warnings.push("NEXT_PUBLIC_TENDERLY_PUBLIC_RPC not set — using configured chain RPC fallback for runtime reads");
  }

  const networkResult = await Promise.allSettled([provider.getNetwork(), provider.getBlockNumber()]);
  const network = networkResult[0].status === "fulfilled" ? networkResult[0].value : null;
  const blockNumber = networkResult[1].status === "fulfilled" ? networkResult[1].value : null;

  if (networkResult[0].status === "rejected") {
    warnings.push(`network probe failed: ${networkResult[0].reason instanceof Error ? networkResult[0].reason.message : "unknown error"}`);
  }
  if (networkResult[1].status === "rejected") {
    warnings.push(`block probe failed: ${networkResult[1].reason instanceof Error ? networkResult[1].reason.message : "unknown error"}`);
  }

  let totalEthDeposited: string | null = null;
  let totalActionsExecuted: number | null = null;
  let totalValueProtected: string | null = null;
  let totalDecisions: number | null = null;
  let totalThreats: number | null = null;
  let totalProtections: number | null = null;
  let latestRiskOverall: number | null = null;

  const reads: Promise<unknown>[] = [];

  if (CONTRACTS.VAULT !== ZERO_ADDRESS) {
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
    reads.push(vault.getVaultStats());
  } else {
    warnings.push("vault address missing — skipping AegisVault runtime read");
  }

  if (CONTRACTS.DECISION_LOGGER !== ZERO_ADDRESS) {
    const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, provider);
    reads.push(logger.getStats());

    const referenceAddress = process.env.NEXT_PUBLIC_REFERENCE_ADDRESS;
    if (referenceAddress && referenceAddress !== ZERO_ADDRESS) {
      reads.push(logger.getLatestRisk(referenceAddress));
    } else {
      warnings.push("reference address missing — skipping getLatestRisk runtime read");
    }
  } else {
    warnings.push("logger address missing — skipping DecisionLogger runtime read");
  }

  const readResults = reads.length > 0 ? await Promise.allSettled(reads) : [];
  let readIndex = 0;

  if (CONTRACTS.VAULT !== ZERO_ADDRESS) {
    const vaultStatsResult = readResults[readIndex++];
    if (vaultStatsResult?.status === "fulfilled") {
      const vaultStats = vaultStatsResult.value as readonly [bigint, bigint, bigint];
      totalEthDeposited = ethers.formatEther(vaultStats[0]);
      totalActionsExecuted = Number(vaultStats[1]);
      totalValueProtected = ethers.formatEther(vaultStats[2]);
    } else if (vaultStatsResult?.status === "rejected") {
      warnings.push(`vault read failed: ${vaultStatsResult.reason instanceof Error ? vaultStatsResult.reason.message : "unknown error"}`);
    }
  }

  if (CONTRACTS.DECISION_LOGGER !== ZERO_ADDRESS) {
    const loggerStatsResult = readResults[readIndex++];
    if (loggerStatsResult?.status === "fulfilled") {
      const loggerStats = loggerStatsResult.value as readonly [bigint, bigint, bigint];
      totalDecisions = Number(loggerStats[0]);
      totalThreats = Number(loggerStats[1]);
      totalProtections = Number(loggerStats[2]);
    } else if (loggerStatsResult?.status === "rejected") {
      warnings.push(`logger read failed: ${loggerStatsResult.reason instanceof Error ? loggerStatsResult.reason.message : "unknown error"}`);
    }

    const referenceAddress = process.env.NEXT_PUBLIC_REFERENCE_ADDRESS;
    if (referenceAddress && referenceAddress !== ZERO_ADDRESS) {
      const latestRiskResult = readResults[readIndex++];
      if (latestRiskResult?.status === "fulfilled") {
        const latestRisk = latestRiskResult.value as { overallRisk?: bigint; timestamp?: bigint };
        const latestRiskTimestamp = latestRisk.timestamp !== undefined ? Number(latestRisk.timestamp) : 0;
        if (latestRiskTimestamp > 0) {
          latestRiskOverall = latestRisk.overallRisk !== undefined ? Number(latestRisk.overallRisk) : 0;
        }
      } else if (latestRiskResult?.status === "rejected") {
        warnings.push(`latest risk read failed: ${latestRiskResult.reason instanceof Error ? latestRiskResult.reason.message : "unknown error"}`);
      }
    }
  }

  return {
    liveRead:
      networkResult.some((result) => result.status === "fulfilled") ||
      readResults.some((result) => result.status === "fulfilled"),
    rpcUrl,
    explorerUrl: EXPLORER_CONFIG.tenderlyExplorerUrl,
    chainId: network ? Number(network.chainId) : null,
    networkName: formatNetworkName(network?.name ?? "unknown", network ? Number(network.chainId) : null),
    blockNumber,
    totalEthDeposited,
    totalActionsExecuted,
    totalValueProtected,
    totalDecisions,
    totalThreats,
    totalProtections,
    latestRiskOverall,
    warnings,
  };
}