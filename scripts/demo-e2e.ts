// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Full End-to-End On-Chain Demo
// Demonstrates the COMPLETE guardian lifecycle on Hardhat network
//
// Flow: Deploy → Register Agent → Deposit → Monitor → Detect Threat
//       → Execute Protection → Log Decision → Verify State
// ═══════════════════════════════════════════════════════════════

import { ethers } from "hardhat";

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners();
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   AEGIS PROTOCOL — END-TO-END ON-CHAIN DEMO                  ║
║   Full guardian lifecycle for Ethereum positions              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  // ═══════════════════════════════════════════════════════════
  //  PHASE 1: CONTRACT DEPLOYMENT
  // ═══════════════════════════════════════════════════════════
  console.log("═".repeat(60));
  console.log("  PHASE 1: DEPLOYING CONTRACTS");
  console.log("═".repeat(60));

  const registrationFee = ethers.parseEther("0.001");
  const maxAgents = 1000;

  // Deploy Registry
  const Registry = await ethers.getContractFactory("AegisRegistry");
  const registry = await Registry.deploy(registrationFee, maxAgents);
  await registry.waitForDeployment();
  console.log(`  ✓ AegisRegistry deployed:    ${await registry.getAddress()}`);

  // Deploy Vault
  const Vault = await ethers.getContractFactory("AegisVault");
  const vault = await Vault.deploy(await registry.getAddress(), 50, ethers.parseEther("0.001"));
  await vault.waitForDeployment();
  console.log(`  ✓ AegisVault deployed:       ${await vault.getAddress()}`);

  // Deploy Logger
  const Logger = await ethers.getContractFactory("DecisionLogger");
  const logger = await Logger.deploy();
  await logger.waitForDeployment();
  console.log(`  ✓ DecisionLogger deployed:   ${await logger.getAddress()}`);

  // ═══════════════════════════════════════════════════════════
  //  PHASE 2: SYSTEM CONFIGURATION
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 2: CONFIGURING PERMISSIONS");
  console.log("═".repeat(60));

  // Link vault to registry
  await (await registry.setVaultAuthorization(await vault.getAddress(), true)).wait();
  console.log("  ✓ Vault authorized in Registry");

  // Also authorize deployer directly for demo stat updates
  await (await registry.setVaultAuthorization(deployer.address, true)).wait();
  console.log("  ✓ Deployer authorized for agent stats (demo)");

  // Authorize deployer as agent operator in vault
  await (await vault.setOperatorAuthorization(deployer.address, true)).wait();
  console.log("  ✓ Deployer is authorized operator in Vault");

  // Authorize deployer as logger
  await (await logger.setLoggerAuthorization(deployer.address, true)).wait();
  console.log("  ✓ Deployer authorized to log decisions");

  // ═══════════════════════════════════════════════════════════
  //  PHASE 3: REGISTER AI AGENT (ERC-721 NFT)
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 3: REGISTERING AI GUARDIAN AGENT");
  console.log("═".repeat(60));

  const regTx = await registry.registerAgent(
    "Aegis Guardian Alpha",
    "ipfs://QmAegisGuardianAlphaMetadata",
    3, // Archon tier — full autonomy
    { value: registrationFee }
  );
  const regReceipt = await regTx.wait();
  const agentId = 0; // First agent

  const agentInfo = await registry.getAgent(agentId);
  console.log(`  ✓ Agent registered as ERC-721 NFT`);
  console.log(`    Name:     ${agentInfo.name}`);
  console.log(`    Tier:     Archon (full autonomy)`);
  console.log(`    Operator: ${agentInfo.operator}`);
  console.log(`    Token ID: ${agentId}`);
  console.log(`    NFT:      ${await registry.ownerOf(agentId)} owns token #${agentId}`);

  // ═══════════════════════════════════════════════════════════
  //  PHASE 4: USER DEPOSITS INTO VAULT
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 4: USER DEPOSITS INTO AEGIS VAULT");
  console.log("═".repeat(60));

  // User 1 deposits 5 ETH
  const depositAmount1 = ethers.parseEther("5.0");
  await (await vault.connect(user1).deposit({ value: depositAmount1 })).wait();
  console.log(`  ✓ User1 (${user1.address.slice(0,8)}...) deposited ${ethers.formatEther(depositAmount1)} ETH`);

  // User 2 deposits 2 ETH
  const depositAmount2 = ethers.parseEther("2.0");
  await (await vault.connect(user2).deposit({ value: depositAmount2 })).wait();
  console.log(`  ✓ User2 (${user2.address.slice(0,8)}...) deposited ${ethers.formatEther(depositAmount2)} ETH`);

  // Check vault state
  const pos1 = await vault.getPosition(user1.address);
  const pos2 = await vault.getPosition(user2.address);
  console.log(`  → Vault total: ${ethers.formatEther(await vault.totalEthDeposited())} ETH`);
  console.log(`  → User1 balance: ${ethers.formatEther(pos1.ethBalance)} ETH`);
  console.log(`  → User2 balance: ${ethers.formatEther(pos2.ethBalance)} ETH`);

  // ═══════════════════════════════════════════════════════════
  //  PHASE 5: USERS AUTHORIZE AI AGENT
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 5: USERS AUTHORIZE AI GUARDIAN");
  console.log("═".repeat(60));

  // Users authorize the agent
  await (await vault.connect(user1).authorizeAgent(agentId)).wait();
  console.log(`  ✓ User1 authorized Agent #${agentId}`);
  
  await (await vault.connect(user2).authorizeAgent(agentId)).wait();
  console.log(`  ✓ User2 authorized Agent #${agentId}`);

  // User1 customizes risk profile
  await (await vault.connect(user1).updateRiskProfile(
    150,    // 1.5% max slippage
    800,    // 8% stop-loss
    ethers.parseEther("3.0"), // Max 3 ETH per action
    true,   // Allow auto-withdraw
    false   // Don't allow auto-swap
  )).wait();
  console.log(`  ✓ User1 set custom risk profile (8% stop-loss, auto-withdraw enabled)`);

  await (await vault.connect(user2).updateRiskProfile(
    200,    // 2% max slippage
    1500,   // 15% stop-loss
    ethers.parseEther("5.0"), // Max 5 ETH per action
    true,   // Allow auto-withdraw
    true    // Allow auto-swap
  )).wait();
  console.log(`  ✓ User2 set risk profile (15% stop-loss, full auto-protect)`);

  // ═══════════════════════════════════════════════════════════
  //  PHASE 6: AI OBSERVES — NORMAL CONDITIONS
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 6: AI MONITORS — NORMAL CONDITIONS (Cycle 1)");
  console.log("═".repeat(60));

  // Log a normal risk assessment
  const normalDecisionTx = await logger.logDecision(
    agentId,
    user1.address,
    3, // AllClear
    0, // RiskLevel.None
    9500, // 95% confidence
    ethers.keccak256(ethers.toUtf8Bytes("All monitored metrics within normal parameters.")),
    ethers.keccak256(ethers.toUtf8Bytes("ETH=$3240,vol=+12%,liq=+3%")),
    false, // No action taken
    0
  );
  await normalDecisionTx.wait();
  console.log("  📡 Observed: ETH at $3,240, volume normal, liquidity stable");
  console.log("  🧠 Analysis: Risk 12/100 [NONE] — Confidence 95%");
  console.log("  ⚡ Decision: ALL CLEAR — no intervention needed");
  console.log("  ✓ Decision logged on-chain (DecisionLogger)");

  // Log risk snapshot
  await (await logger.updateRiskSnapshot(
    user1.address,
    0, // None
    500,  // 5% liquidation risk
    1200, // 12% volatility
    300,  // 3% protocol risk
    200,  // 2% smart contract risk
    ethers.keccak256(ethers.toUtf8Bytes("Normal market conditions"))
  )).wait();
  console.log("  ✓ Risk snapshot recorded on-chain");

  // ═══════════════════════════════════════════════════════════
  //  PHASE 7: AI DETECTS THREAT — TRIGGERS PROTECTION
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 7: 🚨 THREAT DETECTED — PROTECTION TRIGGERED (Cycle 5)");
  console.log("═".repeat(60));

  console.log("  📡 Observed: ETH crashed to $2,715, volume +450%, liquidity -18%");
  console.log("  🧠 Analysis: Risk 71/100 [HIGH] — Confidence 90%");
  console.log("  ⚡ Decision: PRICE_CRASH detected → STOP-LOSS triggered");

  // Log the threat detection on-chain
  const threatDecisionTx = await logger.logDecision(
    agentId,
    user1.address,
    1, // ThreatDetected
    3, // RiskLevel.High
    9000, // 90% confidence
    ethers.keccak256(ethers.toUtf8Bytes("HIGH: Price dropped -22% in 24h. Stop-loss threshold breached.")),
    ethers.keccak256(ethers.toUtf8Bytes("ETH=$2715,vol=+450%,liq=-18%")),
    true, // Action will be taken
    0
  );
  await threatDecisionTx.wait();
  console.log("  ✓ Threat decision logged on-chain");

  // Log updated risk snapshot
  await (await logger.updateRiskSnapshot(
    user1.address,
    3, // High
    7100, // 71% liquidation risk
    8500, // 85% volatility
    4500, // 45% protocol risk
    1500, // 15% smart contract risk
    ethers.keccak256(ethers.toUtf8Bytes("CRITICAL: Price crash with cascading liquidity drain"))
  )).wait();
  console.log("  ✓ Updated risk snapshot on-chain (High risk)");

  // Execute protection action — stop-loss for User1
  const protectionValue = ethers.parseEther("2.5"); // Protect 2.5 ETH (50% of position)
  const protectTx = await vault.executeProtection(
    user1.address,
    3, // StopLoss
    protectionValue,
    ethers.keccak256(ethers.toUtf8Bytes("Auto stop-loss: price crash -22%"))
  );
  const protectReceipt = await protectTx.wait();
  console.log(`  🛡️  PROTECTION EXECUTED: Stop-loss for User1`);
  console.log(`     → Withdrew ${ethers.formatEther(protectionValue)} ETH to safety`);
  console.log(`     → Tx: ${protectReceipt?.hash}`);

  // Update agent stats
  await (await registry.recordAgentAction(agentId, true, protectionValue)).wait();
  console.log("  ✓ Agent stats updated in Registry");

  // ═══════════════════════════════════════════════════════════
  //  PHASE 8: CRITICAL THREAT — EMERGENCY WITHDRAWAL
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 8: 🔴 CRITICAL — RUG PULL DETECTED (Cycle 8)");
  console.log("═".repeat(60));

  console.log("  📡 Observed: Liquidity dropped -85%, price -68%");
  console.log("  🧠 Analysis: Risk 95/100 [CRITICAL] — Confidence 92%");
  console.log("  ⚡ Decision: RUG_PULL pattern → EMERGENCY WITHDRAWAL");

  // Log critical decision
  await (await logger.logDecision(
    agentId,
    user2.address,
    2, // ProtectionTriggered
    4, // Critical
    9200, // 92% confidence
    ethers.keccak256(ethers.toUtf8Bytes("CRITICAL: Rug pull pattern — liquidity drain -85% with -68% price crash")),
    ethers.keccak256(ethers.toUtf8Bytes("ETH=$1980,vol=+1200%,liq=-85%")),
    true,
    1
  )).wait();
  console.log("  ✓ Critical decision logged");

  // Emergency protection for User2 — withdraw everything
  const user2Balance = (await vault.getPosition(user2.address)).ethBalance;
  const protectTx2 = await vault.executeProtection(
    user2.address,
    0, // EmergencyWithdraw
    user2Balance,
    ethers.keccak256(ethers.toUtf8Bytes("Emergency: rug pull detected"))
  );
  await protectTx2.wait();
  console.log(`  🛡️  EMERGENCY WITHDRAWAL for User2: ${ethers.formatEther(user2Balance)} ETH saved`);

  // Update agent stats
  await (await registry.recordAgentAction(agentId, true, user2Balance)).wait();

  // ═══════════════════════════════════════════════════════════
  //  PHASE 9: USER GIVES REPUTATION FEEDBACK
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 9: USER REWARDS AGENT WITH REPUTATION");
  console.log("═".repeat(60));

  await (await registry.connect(user1).giveFeedback(agentId, 5, "Saved my position during price crash! Best guardian.")).wait();
  console.log("  ✓ User1 rated Agent #0: ★★★★★ (5/5)");
  console.log('    "Saved my position during price crash! Best guardian."');

  await (await registry.connect(user2).giveFeedback(agentId, 5, "Emergency withdrawal saved my funds. Amazing.")).wait();
  console.log("  ✓ User2 rated Agent #0: ★★★★★ (5/5)");
  console.log('    "Emergency withdrawal saved my funds. Amazing."');

  // ═══════════════════════════════════════════════════════════
  //  PHASE 10: FINAL STATE VERIFICATION
  // ═══════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 10: ON-CHAIN STATE VERIFICATION");
  console.log("═".repeat(60));

  // Agent stats
  const finalAgent = await registry.getAgent(agentId);
  const reputation = await registry.getReputationScore(agentId);
  const successRate = await registry.getSuccessRate(agentId);
  
  console.log("\n  📊 Agent Performance (On-Chain):");
  console.log(`     Name:              ${finalAgent.name}`);
  console.log(`     Total Decisions:   ${finalAgent.totalDecisions}`);
  console.log(`     Successful:        ${finalAgent.successfulActions}`);
  console.log(`     Value Protected:   ${ethers.formatEther(finalAgent.totalValueProtected)} ETH`);
  console.log(`     Success Rate:      ${Number(successRate) / 100}%`);
  console.log(`     Reputation:        ${Number(reputation) / 100}/5.00`);

  // Decision log stats
  const logStats = await logger.getStats();
  console.log("\n  📝 Decision Log (On-Chain):");
  console.log(`     Total Decisions:   ${logStats[0]}`);
  console.log(`     Threats Detected:  ${logStats[1]}`);
  console.log(`     Protections:       ${logStats[2]}`);

  // Vault stats
  const vaultStats = await vault.getVaultStats();
  console.log("\n  🏦 Vault Stats (On-Chain):");
  console.log(`     Total Deposited:   ${ethers.formatEther(vaultStats[0])} ETH`);
  console.log(`     Actions Executed:  ${vaultStats[1]}`);
  console.log(`     Value Protected:   ${ethers.formatEther(vaultStats[2])} ETH`);

  // User balances after protection
  const finalPos1 = await vault.getPosition(user1.address);
  const finalPos2 = await vault.getPosition(user2.address);
  console.log("\n  👤 Final User Positions:");
  console.log(`     User1: ${ethers.formatEther(finalPos1.ethBalance)} ETH remaining in vault (${ethers.formatEther(protectionValue)} ETH saved)`);
  console.log(`     User2: ${ethers.formatEther(finalPos2.ethBalance)} ETH remaining in vault (${ethers.formatEther(user2Balance)} ETH saved)`);

  // Verify recent decisions from logger
  const recentDecisions = await logger.getRecentDecisions(3);
  console.log("\n  📜 Last 3 Decisions Logged:");
  for (let i = 0; i < recentDecisions.length; i++) {
    const d = recentDecisions[i];
    const types = ["RiskAssessment", "ThreatDetected", "ProtectionTriggered", "AllClear", "MarketAnalysis", "PositionReview"];
    const levels = ["None", "Low", "Medium", "High", "Critical"];
    console.log(`     [${i+1}] Type: ${types[Number(d.decisionType)]} | Risk: ${levels[Number(d.riskLevel)]} | Confidence: ${Number(d.confidence)/100}% | Action: ${d.actionTaken ? "YES" : "No"}`);
  }

  console.log(`

${"═".repeat(60)}
  ✅ END-TO-END DEMO COMPLETE — ALL ON-CHAIN
${"═".repeat(60)}

  Summary:
  ┌─────────────────────────────────────────────────────────┐
  │  ✓ 3 contracts deployed & configured                   │
  │  ✓ AI agent registered as ERC-721 NFT                  │
  │  ✓ 2 users deposited ETH into vault                    │
  │  ✓ Users authorized AI agent as guardian                │
  │  ✓ Custom risk profiles configured                     │
  │  ✓ Normal monitoring cycle logged                      │
  │  ✓ Price crash detected → Stop-loss executed            │
  │  ✓ Rug pull detected → Emergency withdrawal executed   │
  │  ✓ 4.5 ETH total value protected autonomously          │
  │  ✓ 3 decisions permanently logged on-chain             │
  │  ✓ Agent reputation updated by users                   │
  │  ✓ All state verifiable on-chain                       │
  └─────────────────────────────────────────────────────────┘

  Aegis Protocol: AI Never Sleeps. Your Guardian Always Protects.
`);
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exitCode = 1;
});
