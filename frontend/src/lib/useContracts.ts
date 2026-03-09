/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACTS, EXPLORER_CONFIG, PRIMARY_RPC_URL, TARGET_CHAIN_DECIMAL, getTenderlyTxUrl } from "./constants";
import { REGISTRY_ABI, VAULT_ABI, LOGGER_ABI } from "./abis";

// ─── Types ────────────────────────────────────────────────────

export interface AgentInfo {
  name: string;
  operator: string;
  tier: number;
  status: number;
  totalDecisions: number;
  successfulActions: number;
  totalValueProtected: string; // formatted ETH
  registeredAt: number;
}

export interface VaultStats {
  totalEthDeposited: string;
  totalActionsExecuted: number;
  totalValueProtected: string;
}

export interface UserPosition {
  ethBalance: string;
  isActive: boolean;
  agentAuthorized: boolean;
  authorizedAgentId: number;
  depositTimestamp: number;
  riskProfile: {
    maxSlippage: number;
    stopLossThreshold: number;
    maxSingleActionValue: string;
    allowAutoWithdraw: boolean;
    allowAutoSwap: boolean;
  };
}

export interface Decision {
  agentId: number;
  targetUser: string;
  decisionType: number;
  riskLevel: number;
  confidence: number;
  timestamp: number;
  actionTaken: boolean;
}

export interface LoggerStats {
  totalDecisions: number;
  totalThreats: number;
  totalProtections: number;
}

export interface RiskSnapshot {
  overallRisk: number;
  liquidationRisk: number;
  volatilityScore: number;
  protocolRisk: number;
  smartContractRisk: number;
}

export interface DecisionLogInput {
  agentId: number;
  targetUser: string;
  decisionType: number;
  riskLevel: number;
  confidence: number;
  analysisHash: string;
  dataHash: string;
  actionTaken: boolean;
  actionId: number;
}

export interface ContractWriteResult {
  txHash: string;
  blockNumber: number | null;
  status: number | null;
  explorerUrl: string;
}

function getInjectedEthereumProvider(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null {
  if (typeof window === "undefined") return null;

  const ethereum = (window as typeof window & { ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!ethereum || typeof ethereum.request !== "function") {
    return null;
  }

  return ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
}

function normalizeWriteError(error: unknown): string {
  const err = error as any;
  const candidateMessages = [
    err?.reason,
    err?.shortMessage,
    err?.info?.payload?.error?.message,
    err?.info?.error?.message,
    err?.payload?.error?.message,
    err?.error?.message,
    err?.data?.message,
    err?.cause?.message,
    err?.message,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  const message = candidateMessages[0] ?? "CRE write failed";

  if (err?.code === 4001 || /user rejected|user denied|rejected the request/i.test(message)) {
    return "Transaction rejected in MetaMask";
  }

  if (/could not decode result data|BAD_DATA|missing revert data/i.test(message)) {
    return `Could not read DecisionLogger on the connected network. Switch MetaMask to ${EXPLORER_CONFIG.chainName} (${TARGET_CHAIN_DECIMAL}) and try again.`;
  }

  return message;
}

// ─── Contract Data Hook ──────────────────────────────────────

export function useContractData(provider: ethers.BrowserProvider | null) {
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loggerStats, setLoggerStats] = useState<LoggerStats | null>(null);
  const [riskSnapshot, setRiskSnapshot] = useState<RiskSnapshot | null>(null);
  const [reputation, setReputation] = useState<number>(0);
  const [successRate, setSuccessRate] = useState<number>(0);
  const [agentCount, setAgentCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const isDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  const fetchAll = useCallback(async (userAddress?: string) => {
    if (!provider || !isDeployed) return;
    
    setLoading(true);
    try {
      const readProvider = provider;
      
      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, readProvider);
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, readProvider);
      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, readProvider);

      // Fetch all data in parallel for speed
      const results = await Promise.allSettled([
        registry.getAgent(0),
        registry.getAgentCount(),
        registry.getReputationScore(0),
        registry.getSuccessRate(0),
        vault.getVaultStats(),
        logger.getStats(),
        logger.getRecentDecisions(10),
        userAddress ? vault.getPosition(userAddress) : Promise.resolve(null),
        userAddress ? logger.getLatestRisk(userAddress) : Promise.resolve(null),
      ]);

      // Parse agent info
      if (results[0].status === "fulfilled" && results[0].value) {
        const a = results[0].value;
        setAgentInfo({
          name: a.name,
          operator: a.operator,
          tier: Number(a.tier),
          status: Number(a.status),
          totalDecisions: Number(a.totalDecisions),
          successfulActions: Number(a.successfulActions),
          totalValueProtected: ethers.formatEther(a.totalValueProtected),
          registeredAt: Number(a.registeredAt),
        });
      }

      // Agent count
      if (results[1].status === "fulfilled") {
        setAgentCount(Number(results[1].value));
      }

      // Reputation
      if (results[2].status === "fulfilled") {
        setReputation(Number(results[2].value) / 100); // scaled by 100
      }

      // Success rate
      if (results[3].status === "fulfilled") {
        setSuccessRate(Number(results[3].value) / 100); // basis points to %
      }

      // Vault stats
      if (results[4].status === "fulfilled") {
        const v = results[4].value;
        setVaultStats({
          totalEthDeposited: ethers.formatEther(v[0]),
          totalActionsExecuted: Number(v[1]),
          totalValueProtected: ethers.formatEther(v[2]),
        });
      }

      // Logger stats
      if (results[5].status === "fulfilled") {
        const s = results[5].value;
        setLoggerStats({
          totalDecisions: Number(s[0]),
          totalThreats: Number(s[1]),
          totalProtections: Number(s[2]),
        });
      }

      // Recent decisions
      if (results[6].status === "fulfilled") {
        const raw = results[6].value as any[];
        setDecisions(raw.map((d: any) => ({
          agentId: Number(d.agentId),
          targetUser: d.targetUser,
          decisionType: Number(d.decisionType),
          riskLevel: Number(d.riskLevel),
          confidence: Number(d.confidence) / 100,
          timestamp: Number(d.timestamp),
          actionTaken: d.actionTaken,
        })));
      }

      // User position
      if (results[7].status === "fulfilled" && results[7].value) {
        const p = results[7].value;
        setUserPosition({
          ethBalance: ethers.formatEther(p.ethBalance),
          isActive: p.isActive,
          agentAuthorized: p.agentAuthorized,
          authorizedAgentId: Number(p.authorizedAgentId),
          depositTimestamp: Number(p.depositTimestamp),
          riskProfile: {
            maxSlippage: Number(p.riskProfile.maxSlippage),
            stopLossThreshold: Number(p.riskProfile.stopLossThreshold),
            maxSingleActionValue: ethers.formatEther(p.riskProfile.maxSingleActionValue),
            allowAutoWithdraw: p.riskProfile.allowAutoWithdraw,
            allowAutoSwap: p.riskProfile.allowAutoSwap,
          },
        });
      }

      // Risk snapshot
      if (results[8].status === "fulfilled" && results[8].value) {
        const r = results[8].value;
        if (Number(r.timestamp) > 0) {
          setRiskSnapshot({
            overallRisk: Number(r.overallRisk),
            liquidationRisk: Number(r.liquidationRisk) / 100,
            volatilityScore: Number(r.volatilityScore) / 100,
            protocolRisk: Number(r.protocolRisk) / 100,
            smartContractRisk: Number(r.smartContractRisk) / 100,
          });
        }
      }

      setIsLive(true);
    } catch (err: any) {
      console.warn("Contract data fetch failed:", err.message);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [provider, isDeployed]);

  return {
    agentInfo,
    vaultStats,
    userPosition,
    decisions,
    loggerStats,
    riskSnapshot,
    reputation,
    successRate,
    agentCount,
    loading,
    isLive,
    isDeployed,
    fetchAll,
  };
}

// ─── Public Read-Only Hook (no wallet needed) ─────────────────

export function usePublicContractData() {
  const [agentCount, setAgentCount] = useState<number>(0);
  const [totalDecisions, setTotalDecisions] = useState<number>(0);
  const [totalThreats, setTotalThreats] = useState<number>(0);
  const [totalProtections, setTotalProtections] = useState<number>(0);
  const [totalDeposited, setTotalDeposited] = useState<string>("0");
  const [totalValueProtected, setTotalValueProtected] = useState<string>("0");
  const [totalActionsExecuted, setTotalActionsExecuted] = useState<number>(0);
  const [agentName, setAgentName] = useState<string>("");
  const [agentTier, setAgentTier] = useState<number>(0);
  const [agentOperator, setAgentOperator] = useState<string>("");
  const [agentTotalDecisions, setAgentTotalDecisions] = useState<number>(0);
  const [agentSuccessfulActions, setAgentSuccessfulActions] = useState<number>(0);
  const [agentTotalValueProtected, setAgentTotalValueProtected] = useState<string>("0");
  const [agentRegisteredAt, setAgentRegisteredAt] = useState<number>(0);
  const [agentReputation, setAgentReputation] = useState<number>(0);
  const [agentSuccessRate, setAgentSuccessRate] = useState<number>(0);
  const [recentDecisions, setRecentDecisions] = useState<Decision[]>([]);
  const [publicRiskSnapshot, setPublicRiskSnapshot] = useState<RiskSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const isDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  const fetchPublicData = useCallback(async () => {
    if (!isDeployed) return;
    try {
      const rpc = new ethers.JsonRpcProvider(PRIMARY_RPC_URL);
      const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, rpc);
      const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, rpc);
      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, rpc);

      // Reference address — used for public risk snapshot reads
      const referenceAddress = process.env.NEXT_PUBLIC_REFERENCE_ADDRESS || ethers.ZeroAddress;

      const results = await Promise.allSettled([
        registry.getAgentCount(),
        registry.getAgent(0),
        registry.getReputationScore(0),
        registry.getSuccessRate(0),
        vault.getVaultStats(),
        logger.getStats(),
        logger.getRecentDecisions(10),
        logger.getLatestRisk(referenceAddress),
      ]);

      if (results[0].status === "fulfilled") setAgentCount(Number(results[0].value));
      if (results[1].status === "fulfilled") {
        const a = results[1].value;
        setAgentName(a.name);
        setAgentTier(Number(a.tier));
        setAgentOperator(a.operator);
        setAgentTotalDecisions(Number(a.totalDecisions));
        setAgentSuccessfulActions(Number(a.successfulActions));
        setAgentTotalValueProtected(ethers.formatEther(a.totalValueProtected));
        setAgentRegisteredAt(Number(a.registeredAt));
      }
      if (results[2].status === "fulfilled") setAgentReputation(Number(results[2].value) / 100);
      if (results[3].status === "fulfilled") setAgentSuccessRate(Number(results[3].value) / 100);
      if (results[4].status === "fulfilled") {
        const v = results[4].value;
        setTotalDeposited(ethers.formatEther(v[0]));
        setTotalActionsExecuted(Number(v[1]));
        setTotalValueProtected(ethers.formatEther(v[2]));
      }
      if (results[5].status === "fulfilled") {
        const s = results[5].value;
        setTotalDecisions(Number(s[0]));
        setTotalThreats(Number(s[1]));
        setTotalProtections(Number(s[2]));
      }
      if (results[6].status === "fulfilled") {
        const raw = results[6].value as any[];
        setRecentDecisions(raw.map((d: any) => ({
          agentId: Number(d.agentId),
          targetUser: d.targetUser,
          decisionType: Number(d.decisionType),
          riskLevel: Number(d.riskLevel),
          confidence: Number(d.confidence) / 100,
          timestamp: Number(d.timestamp),
          actionTaken: d.actionTaken,
        })));
      }
      if (results[7].status === "fulfilled" && results[7].value) {
        const r = results[7].value;
        if (Number(r.timestamp) > 0) {
          setPublicRiskSnapshot({
            overallRisk: Number(r.overallRisk),
            liquidationRisk: Number(r.liquidationRisk) / 100,
            volatilityScore: Number(r.volatilityScore) / 100,
            protocolRisk: Number(r.protocolRisk) / 100,
            smartContractRisk: Number(r.smartContractRisk) / 100,
          });
        }
      }

      setIsLive(true);
      setLoaded(true);
    } catch (err: any) {
      console.warn("Public RPC fetch failed:", err.message);
      setIsLive(false);
      setLoaded(true);
    }
  }, [isDeployed]);

  return {
    agentCount, totalDecisions, totalThreats, totalProtections,
    totalDeposited, totalValueProtected, totalActionsExecuted,
    agentName, agentTier, agentOperator,
    agentTotalDecisions, agentSuccessfulActions, agentTotalValueProtected, agentRegisteredAt,
    agentReputation, agentSuccessRate,
    recentDecisions, publicRiskSnapshot, loaded, isLive, fetchPublicData,
  };
}

// ─── Contract Write Hook ─────────────────────────────────────

export function useContractWrite(signer: ethers.Signer | null) {
  const isDeployed = CONTRACTS.REGISTRY !== "0x0000000000000000000000000000000000000000";

  const deposit = useCallback(async (amountEth: string) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const tx = await vault.deposit({ value: ethers.parseEther(amountEth) });
    return tx.wait();
  }, [signer, isDeployed]);

  const withdraw = useCallback(async (amountEth: string) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const amount = amountEth === "0" ? BigInt(0) : ethers.parseEther(amountEth);
    const tx = await vault.withdraw(amount);
    return tx.wait();
  }, [signer, isDeployed]);

  const authorizeAgent = useCallback(async (agentId: number) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const tx = await vault.authorizeAgent(agentId);
    return tx.wait();
  }, [signer, isDeployed]);

  const emergencyWithdraw = useCallback(async () => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);
    const tx = await vault.emergencyWithdraw();
    return tx.wait();
  }, [signer, isDeployed]);

  const giveFeedback = useCallback(async (agentId: number, score: number, comment: string) => {
    if (!signer || !isDeployed) throw new Error("Not connected");
    const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, signer);
    const tx = await registry.giveFeedback(agentId, score, comment);
    return tx.wait();
  }, [signer, isDeployed]);

  const logDecision = useCallback(async (input: DecisionLogInput): Promise<ContractWriteResult> => {
    if (!signer || !isDeployed) throw new Error("Connect your wallet before running the CRE write");

    try {
      const signerProvider = signer.provider;
      if (!signerProvider) {
        throw new Error("Wallet provider unavailable");
      }

      const network = await signerProvider.getNetwork();
      const connectedChainId = Number(network.chainId);
      if (connectedChainId !== TARGET_CHAIN_DECIMAL) {
        throw new Error(
          `Wallet is connected to chain ${connectedChainId}. Switch MetaMask to ${EXPLORER_CONFIG.chainName} (${TARGET_CHAIN_DECIMAL}) and try again.`
        );
      }

      const deployedCode = await signerProvider.getCode(CONTRACTS.DECISION_LOGGER);
      if (!deployedCode || deployedCode === "0x") {
        throw new Error(`DecisionLogger is not deployed at ${CONTRACTS.DECISION_LOGGER} on ${EXPLORER_CONFIG.chainName}`);
      }

      const logger = new ethers.Contract(CONTRACTS.DECISION_LOGGER, LOGGER_ABI, signer);
      const signerAddress = await signer.getAddress();
      const isAuthorized = await logger.authorizedLoggers(signerAddress);

      if (!isAuthorized) {
        throw new Error(`Wallet ${signerAddress.slice(0, 6)}...${signerAddress.slice(-4)} is not authorized for DecisionLogger writes`);
      }

      const args = [
        input.agentId,
        input.targetUser,
        input.decisionType,
        input.riskLevel,
        input.confidence,
        input.analysisHash,
        input.dataHash,
        input.actionTaken,
        input.actionId,
      ] as const;

      await logger.logDecision.staticCall(...args);
      const estimatedGas = await logger.logDecision.estimateGas(...args);
      const gasLimit = (estimatedGas * 120n) / 100n;

      const injectedEthereum = getInjectedEthereumProvider();
      let txHash: string;

      if (injectedEthereum) {
        const populatedTx = await logger.logDecision.populateTransaction(...args);
        if (!populatedTx.data) {
          throw new Error("Could not build DecisionLogger transaction data");
        }

        const feeData = await signerProvider.getFeeData();
        const txRequest: Record<string, string> = {
          from: signerAddress,
          to: populatedTx.to ?? CONTRACTS.DECISION_LOGGER,
          data: populatedTx.data,
          gas: ethers.toQuantity(gasLimit),
        };

        if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
          txRequest.maxFeePerGas = ethers.toQuantity(feeData.maxFeePerGas);
          txRequest.maxPriorityFeePerGas = ethers.toQuantity(feeData.maxPriorityFeePerGas);
        } else if (feeData.gasPrice != null) {
          txRequest.gasPrice = ethers.toQuantity(feeData.gasPrice);
        }

        txHash = await injectedEthereum.request({
          method: "eth_sendTransaction",
          params: [txRequest],
        }) as string;
      } else {
        const tx = await logger.logDecision(...args, { gasLimit });
        txHash = tx.hash;
      }

      const receipt = await signerProvider.waitForTransaction(txHash);
      if (!receipt) {
        throw new Error("DecisionLogger transaction was submitted but no receipt was returned");
      }

      return {
        txHash,
        blockNumber: receipt?.blockNumber ?? null,
        status: receipt?.status ?? null,
        explorerUrl: getTenderlyTxUrl(txHash),
      };
    } catch (error) {
      throw new Error(normalizeWriteError(error));
    }
  }, [signer, isDeployed]);

  return { deposit, withdraw, authorizeAgent, emergencyWithdraw, giveFeedback, logDecision, isDeployed };
}
