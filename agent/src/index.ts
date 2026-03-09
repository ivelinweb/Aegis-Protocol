// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Main Agent Loop
// Observe → Analyze → Decide → Execute — Autonomous DeFi Guardian
// ═══════════════════════════════════════════════════════════════

import * as dotenv from "dotenv";
import { PositionMonitor } from "./monitor";
import { RiskAnalyzer, RiskLevel, SuggestedAction } from "./analyzer";
import { OnChainExecutor } from "./executor";
import { AIReasoningEngine } from "./ai-engine";
import { UniswapProvider } from "./uniswap";
import { ethers } from "ethers";

dotenv.config({ path: "../.env" });

// ─── Configuration ────────────────────────────────────────────

const CONFIG = {
  rpcUrl: process.env.ETH_MAINNET_RPC || "https://ethereum-rpc.publicnode.com",
  privateKey: process.env.PRIVATE_KEY || "",
  vaultAddress: process.env.VAULT_ADDRESS || "",
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  loggerAddress: process.env.LOGGER_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "0"),
  pollInterval: parseInt(process.env.POLL_INTERVAL || "30000"), // 30s default
  dryRun: process.env.DRY_RUN !== "false", // default to dry run
};

// ─── ASCII Banner ─────────────────────────────────────────────

// ─── Config Validation ────────────────────────────────────────
function validateConfig(): void {
  const errors: string[] = [];
  
  if (!CONFIG.privateKey) {
    errors.push("PRIVATE_KEY is required (set in .env or environment)");
  } else if (!/^[0-9a-fA-F]{64}$/.test(CONFIG.privateKey)) {
    errors.push("PRIVATE_KEY must be a 64-character hex string (without 0x prefix)");
  }

  if (CONFIG.vaultAddress && !ethers.isAddress(CONFIG.vaultAddress)) {
    errors.push(`VAULT_ADDRESS is not a valid address: ${CONFIG.vaultAddress}`);
  }
  if (CONFIG.registryAddress && !ethers.isAddress(CONFIG.registryAddress)) {
    errors.push(`REGISTRY_ADDRESS is not a valid address: ${CONFIG.registryAddress}`);
  }
  if (CONFIG.loggerAddress && !ethers.isAddress(CONFIG.loggerAddress)) {
    errors.push(`LOGGER_ADDRESS is not a valid address: ${CONFIG.loggerAddress}`);
  }

  if (CONFIG.pollInterval < 5000) {
    errors.push("POLL_INTERVAL must be at least 5000ms (5 seconds)");
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuration errors:");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\n   See .env.example for required variables.\n");
    process.exit(1);
  }

  // Warnings (non-fatal)
  if (!CONFIG.vaultAddress || !CONFIG.registryAddress || !CONFIG.loggerAddress) {
    console.warn("⚠  Missing contract addresses — agent will run in monitor-only mode");
  }
  if (CONFIG.dryRun) {
    console.warn("⚠  DRY_RUN=true — no on-chain transactions will be executed");
  }
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn("⚠  No AI API key configured — using heuristic fallback only");
  }
}

// ─── ASCII Banner (cont.) ─────────────────────────────────────

function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     █████╗ ███████╗ ██████╗ ██╗███████╗                       ║
║    ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝                       ║
║    ███████║█████╗  ██║  ███╗██║███████╗                       ║
║    ██╔══██║██╔══╝  ██║   ██║██║╚════██║                       ║
║    ██║  ██║███████╗╚██████╔╝██║███████║                       ║
║    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝                       ║
║                                                               ║
║    AI-Powered Autonomous DeFi Guardian                        ║
    ║    Built for Ethereum Mainnet · Uniswap Verified Defense      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

// ─── Main Agent Class ─────────────────────────────────────────

class AegisAgent {
  private monitor: PositionMonitor;
  private analyzer: RiskAnalyzer;
  private executor: OnChainExecutor;
  private aiEngine: AIReasoningEngine;
  private uniswap: UniswapProvider;
  private isRunning = false;
  private cycleCount = 0;
  private startTime = Date.now();

  constructor() {
    // Initialize Monitor
    this.monitor = new PositionMonitor({
      rpcUrl: CONFIG.rpcUrl,
      pollInterval: CONFIG.pollInterval,
      vaultAddress: CONFIG.vaultAddress,
      registryAddress: CONFIG.registryAddress,
      loggerAddress: CONFIG.loggerAddress,
    });

    // Initialize AI Risk Analyzer
    this.analyzer = new RiskAnalyzer();

    // Initialize LLM-Powered AI Engine
    this.aiEngine = new AIReasoningEngine();

    // Initialize Uniswap DEX Provider
    this.uniswap = new UniswapProvider(CONFIG.rpcUrl);

    // Initialize On-Chain Executor
    this.executor = new OnChainExecutor(
      {
        privateKey: CONFIG.privateKey,
        vaultAddress: CONFIG.vaultAddress,
        registryAddress: CONFIG.registryAddress,
        loggerAddress: CONFIG.loggerAddress,
        agentId: CONFIG.agentId,
        dryRun: CONFIG.dryRun,
      },
      this.monitor.getProvider()
    );
  }

  /**
   * Start the autonomous agent loop
   */
  async start(): Promise<void> {
    printBanner();

    console.log("\n[Aegis Agent] Starting autonomous guardian...");
    console.log(`  Mode: ${CONFIG.dryRun ? "DRY RUN (simulation)" : "LIVE"}`);
    console.log(`  Network: Ethereum Mainnet`);
    console.log(`  Agent ID: ${CONFIG.agentId}`);
    console.log(`  Poll Interval: ${CONFIG.pollInterval / 1000}s`);
    console.log(`  Operator: ${this.executor.getOperatorAddress()}`);
    console.log(`  AI Engine: ${this.aiEngine.isEnabled() ? "LLM-Powered ✓" : "Heuristic Fallback"}`);
    console.log(`  Uniswap V2: Connected ✓`);
    console.log("");

    this.isRunning = true;

    // Initial scan for existing deposits
    try {
      const currentBlock = await this.monitor.getCurrentBlock();
      console.log(`[Aegis Agent] Current block: ${currentBlock}`);
      
      if (currentBlock > 0) {
        const lookback = Math.max(0, currentBlock - 10000);
        const newUsers = await this.monitor.scanForDeposits(lookback);
        if (newUsers.length > 0) {
          console.log(`[Aegis Agent] Found ${newUsers.length} depositors to monitor`);
        }
      }
    } catch (error) {
      console.log("[Aegis Agent] Initial scan skipped (contracts may not be deployed yet)");
    }

    // ─── Main Loop ──────────────────────────────────────────
    while (this.isRunning) {
      try {
        await this.executeCycle();
      } catch (error: any) {
        console.error(`[Aegis Agent] Cycle error: ${error.message}`);
      }

      // Wait for next poll
      await this.sleep(CONFIG.pollInterval);
    }
  }

  /**
   * Execute one complete observation → analysis → decision → action cycle
   */
  private async executeCycle(): Promise<void> {
    this.cycleCount++;
    const cycleStart = Date.now();
    
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[Cycle #${this.cycleCount}] ${new Date().toISOString()}`);
    console.log(`${"═".repeat(60)}`);

    // ─── Phase 1: OBSERVE ─────────────────────────────────
    console.log("\n📡 Phase 1: OBSERVE — Gathering market data...");
    const marketData = await this.monitor.getMarketData();
    console.log(`  ETH Price: $${marketData.price.toFixed(2)}`);
    console.log(`  24h Change: ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%`);
    console.log(`  Volume: $${(marketData.volume24h / 1e6).toFixed(1)}M`);
    console.log(`  Liquidity: $${(marketData.liquidity / 1e9).toFixed(2)}B`);

    // ─── Phase 2: ANALYZE ─────────────────────────────────
    console.log("\n🧠 Phase 2: ANALYZE — Running AI risk assessment...");
    const riskSnapshot = this.analyzer.analyzeRisk(marketData);
    console.log(`  Overall Risk: ${riskSnapshot.overallRisk}/100 (${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][riskSnapshot.riskLevel]})`);
    console.log(`  Confidence: ${riskSnapshot.confidence}%`);
    console.log(`  Liquidation Risk: ${riskSnapshot.liquidationRisk}/100`);
    console.log(`  Volatility Risk: ${riskSnapshot.volatilityRisk}/100`);
    for (const factor of riskSnapshot.factors) {
      console.log(`  → ${factor.name}: ${factor.score}/100 (w=${factor.weight}) — ${factor.description}`);
    }

    // ─── Phase 2.5: LLM AI REASONING ─────────────────────
    console.log("\n🤖 Phase 2.5: AI REASONING — Generating LLM analysis...");
    const aiAnalysis = await this.aiEngine.analyzeMarket(marketData, riskSnapshot);
    console.log(`  AI Sentiment: ${aiAnalysis.marketSentiment}`);
    console.log(`  AI Risk Score: ${aiAnalysis.riskScore}/100`);
    console.log(`  Threats: ${aiAnalysis.threats.length > 0 ? aiAnalysis.threats.join(", ") : "None"}`);
    console.log(`  Key Insights:`);
    for (const insight of aiAnalysis.keyInsights.slice(0, 3)) {
      console.log(`    • ${insight}`);
    }
    console.log(`  Reasoning: ${aiAnalysis.reasoning.slice(0, 200)}...`);

    // ─── Phase 2.7: DEX DATA (Uniswap) ────────────────────
    console.log("\n📊 Phase 2.7: DEX DATA — Uniswap V2 on-chain prices...");
    try {
      const ethPrice = await this.uniswap.getETHPrice();
      if (ethPrice > 0) {
        console.log(`  ETH/USD (Uniswap V2): $${ethPrice.toFixed(2)}`);
        console.log(`  Price Delta (CoinGecko vs DEX): ${((marketData.price - ethPrice) / ethPrice * 100).toFixed(3)}%`);
      }
    } catch (err: any) {
      console.log(`  DEX data unavailable: ${err.message}`);
    }

    // ─── Phase 3: DECIDE ──────────────────────────────────
    console.log("\n⚡ Phase 3: DECIDE — Threat detection...");
    const threat = this.analyzer.detectThreats(marketData);
    console.log(`  Threat Detected: ${threat.threatDetected}`);
    if (threat.threatDetected) {
      console.log(`  Type: ${threat.threatType}`);
      console.log(`  Severity: ${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][threat.severity]}`);
      console.log(`  Confidence: ${threat.confidence}%`);
      console.log(`  Suggested Action: ${threat.suggestedAction}`);
      console.log(`  Reasoning: ${threat.reasoning}`);
    } else {
      console.log(`  Status: All Clear ✓`);
      console.log(`  ${threat.reasoning}`);
    }

    // ─── Phase 4: EXECUTE ─────────────────────────────────
    console.log("\n🔐 Phase 4: EXECUTE — On-chain actions...");
    
    // Log risk snapshot on-chain
    const snapshotTx = await this.executor.logRiskSnapshot(riskSnapshot);
    if (snapshotTx) {
      console.log(`  Risk snapshot logged: ${snapshotTx}`);
    }

    // Log decision for each watched address
    const watchedAddresses = this.monitor.getWatchedAddresses();
    const targetUser = watchedAddresses[0] || ethers.ZeroAddress;
    
    // Hash includes both heuristic reasoning AND LLM analysis for on-chain attestation
    const combinedReasoning = `${threat.reasoning} | AI: ${aiAnalysis.reasoning}`;
    const reasoningHash = this.analyzer.getReasoningHash(combinedReasoning);

    const decisionTx = await this.executor.logDecision(threat, targetUser, reasoningHash);
    if (decisionTx) {
      console.log(`  Decision logged: ${decisionTx}`);
    }

    // Execute protective action if needed
    if (threat.threatDetected && threat.severity >= RiskLevel.HIGH) {
      console.log(`\n🛡️  PROTECTION TRIGGERED: ${threat.suggestedAction}`);
      
      for (const addr of watchedAddresses) {
        const position = await this.monitor.getPosition(addr);
        if (position && position.depositedETH > 0n) {
          const protectionTx = await this.executor.executeProtection(
            addr,
            threat.suggestedAction,
            position.depositedETH,
            threat.reasoning
          );
          if (protectionTx) {
            console.log(`  Protection executed for ${addr}: ${protectionTx}`);
          }
        }
      }
    }

    // ─── Cycle Summary ────────────────────────────────────
    const cycleDuration = Date.now() - cycleStart;
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`\n📊 Cycle #${this.cycleCount} complete in ${cycleDuration}ms | Uptime: ${uptime}s`);
    console.log(`   Total decisions logged: ${this.executor.getExecutionLog().filter(e => e.type === "logDecision").length}`);
    console.log(`   Protections triggered: ${this.executor.getExecutionLog().filter(e => e.type === "protection").length}`);
  }

  stop(): void {
    this.isRunning = false;
    console.log("\n[Aegis Agent] Shutting down...");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Entry Point ──────────────────────────────────────────────

async function main(): Promise<void> {
  validateConfig();
  const agent = new AegisAgent();

  // Graceful shutdown
  process.on("SIGINT", () => {
    agent.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    agent.stop();
    process.exit(0);
  });

  await agent.start();
}

main().catch((error) => {
  console.error("[Aegis Agent] Fatal error:", error);
  process.exit(1);
});
