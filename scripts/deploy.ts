import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ─── Deploy AegisRegistry ─────────────────────────────────
  const registrationFee = ethers.parseEther("0.001"); // 0.001 ETH
  const maxAgents = 10000;

  console.log("\n1. Deploying AegisRegistry...");
  const Registry = await ethers.getContractFactory("AegisRegistry");
  const registry = await Registry.deploy(registrationFee, maxAgents);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   AegisRegistry deployed to:", registryAddress);

  // ─── Deploy AegisVault ────────────────────────────────────
  const protocolFeeBps = 50; // 0.5%
  const minDeposit = ethers.parseEther("0.001"); // 0.001 ETH

  console.log("\n2. Deploying AegisVault...");
  const Vault = await ethers.getContractFactory("AegisVault");
  const vault = await Vault.deploy(registryAddress, protocolFeeBps, minDeposit);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   AegisVault deployed to:", vaultAddress);

  // ─── Deploy DecisionLogger ────────────────────────────────
  console.log("\n3. Deploying DecisionLogger...");
  const Logger = await ethers.getContractFactory("DecisionLogger");
  const logger = await Logger.deploy();
  await logger.waitForDeployment();
  const loggerAddress = await logger.getAddress();
  console.log("   DecisionLogger deployed to:", loggerAddress);

  // ─── Configure Permissions ────────────────────────────────
  console.log("\n4. Configuring permissions...");

  // Authorize vault in registry (so vault can update agent stats)
  const tx1 = await registry.setVaultAuthorization(vaultAddress, true);
  await tx1.wait();
  console.log("   ✓ Vault authorized in Registry");

  // Authorize deployer as operator in vault (for agent operations)
  const tx2 = await vault.setOperatorAuthorization(deployer.address, true);
  await tx2.wait();
  console.log("   ✓ Deployer authorized as operator in Vault");

  // Authorize deployer as logger
  const tx3 = await logger.setLoggerAuthorization(deployer.address, true);
  await tx3.wait();
  console.log("   ✓ Deployer authorized as logger in DecisionLogger");

  // ─── Register Initial Agent ───────────────────────────────
  console.log("\n5. Registering initial Aegis Guardian Agent...");
  const tx4 = await registry.registerAgent(
    "Aegis Guardian Alpha",
    "https://aegis-protocol.io/agent/alpha",
    3, // Archon tier (full autonomy)
    { value: registrationFee }
  );
  await tx4.wait();
  console.log("   ✓ Agent 'Aegis Guardian Alpha' registered (ID: 0)");

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Network:          ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  Chain ID:         ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer:         ${deployer.address}`);
  console.log(`  AegisRegistry:    ${registryAddress}`);
  console.log(`  AegisVault:       ${vaultAddress}`);
  console.log(`  DecisionLogger:   ${loggerAddress}`);
  console.log("═".repeat(60));

  // Save deployment addresses
  const fs = await import("fs");
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      AegisRegistry: registryAddress,
      AegisVault: vaultAddress,
      DecisionLogger: loggerAddress,
    },
    configuration: {
      registrationFee: ethers.formatEther(registrationFee),
      maxAgents: maxAgents,
      protocolFeeBps: protocolFeeBps,
      minDeposit: ethers.formatEther(minDeposit),
    },
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("\n  Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
