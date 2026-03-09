// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — On-Chain Executor
// Executes protective actions and logs decisions on Ethereum
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { RiskLevel, RiskSnapshot, SuggestedAction, ThreatAssessment } from "./analyzer";

export interface ExecutorConfig {
  privateKey: string;
  vaultAddress: string;
  registryAddress: string;
  loggerAddress: string;
  agentId: number;
  dryRun: boolean;   // if true, only logs but doesn't execute txs
}

const VAULT_ABI = [
  "function executeProtection(address user, uint8 actionType, uint256 value, string reason) external",
];

const REGISTRY_ABI = [
  "function updateAgentStats(uint256 tokenId, bool success, uint256 valueProtected) external",
];

const LOGGER_ABI = [
  "function logDecision(uint256 agentId, uint8 decisionType, uint8 riskLevel, uint256 confidence, address targetUser, bytes32 reasoningHash) external returns (uint256)",
  "function logRiskSnapshot(uint256 agentId, uint256 liquidationRisk, uint256 volatilityRisk, uint256 protocolRisk, uint256 smartContractRisk) external",
];

// Maps our SuggestedAction to contract's ActionType enum
const ACTION_TYPE_MAP: Record<string, number> = {
  [SuggestedAction.EMERGENCY_WITHDRAW]: 0,
  [SuggestedAction.REBALANCE]: 1,
  [SuggestedAction.ALERT]: 2,
  [SuggestedAction.STOP_LOSS]: 3,
  [SuggestedAction.TAKE_PROFIT]: 4,
};

// Maps to contract's DecisionType enum
const DECISION_TYPE_MAP: Record<string, number> = {
  "RiskAssessment": 0,
  "ThreatDetected": 1,
  "ProtectionTriggered": 2,
  "AllClear": 3,
  "MarketAnalysis": 4,
  "PositionReview": 5,
};

export class OnChainExecutor {
  private wallet: ethers.Wallet;
  private vault: ethers.Contract;
  private registry: ethers.Contract;
  private logger: ethers.Contract;
  private config: ExecutorConfig;
  private executionLog: ExecutionRecord[] = [];

  constructor(config: ExecutorConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.wallet = new ethers.Wallet(config.privateKey, provider);
    this.vault = new ethers.Contract(config.vaultAddress, VAULT_ABI, this.wallet);
    this.registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, this.wallet);
    this.logger = new ethers.Contract(config.loggerAddress, LOGGER_ABI, this.wallet);
    
    console.log("[Aegis Executor] Initialized");
    console.log(`  Agent ID: ${config.agentId}`);
    console.log(`  Operator: ${this.wallet.address}`);
    console.log(`  Dry Run: ${config.dryRun}`);
  }

  /**
   * Log a risk assessment decision on-chain
   */
  async logDecision(
    threat: ThreatAssessment,
    targetUser: string,
    reasoningHash: string
  ): Promise<string | null> {
    const decisionType = threat.threatDetected
      ? (threat.suggestedAction !== SuggestedAction.NONE && 
         threat.suggestedAction !== SuggestedAction.MONITOR &&
         threat.suggestedAction !== SuggestedAction.ALERT
          ? DECISION_TYPE_MAP["ProtectionTriggered"]
          : DECISION_TYPE_MAP["ThreatDetected"])
      : DECISION_TYPE_MAP["AllClear"];

    const riskLevel = threat.severity;
    const confidence = Math.round(threat.confidence * 100); // scale to basis points

    console.log(`[Aegis Executor] Logging decision: type=${decisionType} risk=${riskLevel} confidence=${threat.confidence}%`);

    if (this.config.dryRun) {
      console.log("[Aegis Executor] DRY RUN — skipping on-chain log");
      this.recordExecution("logDecision", true, "dry-run", targetUser);
      return "dry-run-tx";
    }

    try {
      const tx = await this.logger.logDecision(
        this.config.agentId,
        decisionType,
        riskLevel,
        confidence,
        targetUser,
        reasoningHash
      );
      const receipt = await tx.wait();
      console.log(`[Aegis Executor] Decision logged: ${receipt.hash}`);
      this.recordExecution("logDecision", true, receipt.hash, targetUser);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Aegis Executor] Failed to log decision:", error.message);
      this.recordExecution("logDecision", false, error.message, targetUser);
      return null;
    }
  }

  /**
   * Log a risk snapshot on-chain
   */
  async logRiskSnapshot(snapshot: RiskSnapshot): Promise<string | null> {
    console.log(`[Aegis Executor] Logging risk snapshot: LIQ=${snapshot.liquidationRisk} VOL=${snapshot.volatilityRisk} PROTO=${snapshot.protocolRisk} SC=${snapshot.smartContractRisk}`);

    if (this.config.dryRun) {
      console.log("[Aegis Executor] DRY RUN — skipping risk snapshot");
      return "dry-run-tx";
    }

    try {
      const tx = await this.logger.logRiskSnapshot(
        this.config.agentId,
        snapshot.liquidationRisk,
        snapshot.volatilityRisk,
        snapshot.protocolRisk,
        snapshot.smartContractRisk
      );
      const receipt = await tx.wait();
      console.log(`[Aegis Executor] Risk snapshot logged: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Aegis Executor] Failed to log risk snapshot:", error.message);
      return null;
    }
  }

  /**
   * Execute a protective action on the vault
   */
  async executeProtection(
    userAddress: string,
    action: SuggestedAction,
    value: bigint,
    reason: string
  ): Promise<string | null> {
    const actionType = ACTION_TYPE_MAP[action];
    if (actionType === undefined) {
      console.log(`[Aegis Executor] Action ${action} not executable on-chain`);
      return null;
    }

    console.log(`[Aegis Executor] Executing protection: ${action} for ${userAddress} value=${value}`);

    if (this.config.dryRun) {
      console.log("[Aegis Executor] DRY RUN — skipping protection execution");
      this.recordExecution("protection", true, "dry-run", userAddress);
      return "dry-run-tx";
    }

    try {
      const tx = await this.vault.executeProtection(
        userAddress,
        actionType,
        value,
        reason
      );
      const receipt = await tx.wait();
      console.log(`[Aegis Executor] Protection executed: ${receipt.hash}`);

      // Update agent stats
      await this.updateStats(true, value);
      this.recordExecution("protection", true, receipt.hash, userAddress);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Aegis Executor] Protection failed:", error.message);
      this.recordExecution("protection", false, error.message, userAddress);
      return null;
    }
  }

  /**
   * Update agent performance stats on registry
   */
  private async updateStats(success: boolean, valueProtected: bigint): Promise<void> {
    if (this.config.dryRun) return;
    
    try {
      const tx = await this.registry.updateAgentStats(
        this.config.agentId,
        success,
        valueProtected
      );
      await tx.wait();
      console.log("[Aegis Executor] Agent stats updated");
    } catch (error: any) {
      console.error("[Aegis Executor] Stats update failed:", error.message);
    }
  }

  private recordExecution(type: string, success: boolean, txHash: string, target: string): void {
    this.executionLog.push({
      type,
      success,
      txHash,
      target,
      timestamp: Date.now(),
    });
  }

  getExecutionLog(): ExecutionRecord[] {
    return [...this.executionLog];
  }

  getOperatorAddress(): string {
    return this.wallet.address;
  }
}

interface ExecutionRecord {
  type: string;
  success: boolean;
  txHash: string;
  target: string;
  timestamp: number;
}
