import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("AegisVault", function () {
  const REGISTRATION_FEE = ethers.parseEther("0.01");
  const MAX_AGENTS = 1000;
  const PROTOCOL_FEE_BPS = 50; // 0.5%
  const MIN_DEPOSIT = ethers.parseEther("0.001");

  async function deployFullFixture() {
    const [owner, user1, user2, agentOperator] = await ethers.getSigners();

    // Deploy Registry
    const Registry = await ethers.getContractFactory("AegisRegistry");
    const registry = await Registry.deploy(REGISTRATION_FEE, MAX_AGENTS);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("AegisVault");
    const vault = await Vault.deploy(
      await registry.getAddress(),
      PROTOCOL_FEE_BPS,
      MIN_DEPOSIT
    );

    // Authorize vault in registry
    await registry.setVaultAuthorization(await vault.getAddress(), true);

    // Register an agent
    await registry.connect(agentOperator).registerAgent(
      "Guardian Alpha",
      "ipfs://agent1",
      1, // Guardian tier
      { value: REGISTRATION_FEE }
    );

    // Authorize the agent operator in vault
    await vault.setOperatorAuthorization(agentOperator.address, true);

    return { registry, vault, owner, user1, user2, agentOperator };
  }

  describe("Deployment", function () {
    it("should set correct registry address", async function () {
      const { vault, registry } = await loadFixture(deployFullFixture);
      expect(await vault.registryAddress()).to.equal(await registry.getAddress());
    });

    it("should set correct protocol fee", async function () {
      const { vault } = await loadFixture(deployFullFixture);
      expect(await vault.protocolFeeBps()).to.equal(PROTOCOL_FEE_BPS);
    });

    it("should reject fee > 5%", async function () {
      const { registry } = await loadFixture(deployFullFixture);
      const Vault = await ethers.getContractFactory("AegisVault");
      await expect(
        Vault.deploy(await registry.getAddress(), 600, MIN_DEPOSIT)
      ).to.be.revertedWith("Fee too high");
    });
  });

  describe("Deposits", function () {
    it("should accept ETH deposits", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      const depositAmount = ethers.parseEther("1");
      await expect(
        vault.connect(user1).deposit({ value: depositAmount })
      ).to.emit(vault, "ETHDeposited");

      const position = await vault.getPosition(user1.address);
      expect(position.ethBalance).to.equal(depositAmount);
      expect(await vault.getUserDepositETH(user1.address)).to.equal(depositAmount);
      expect(position.isActive).to.be.true;
    });

    it("should reject deposits below minimum", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await expect(
        vault.connect(user1).deposit({ value: ethers.parseEther("0.0001") })
      ).to.be.revertedWith("Below minimum deposit");
    });

    it("should accumulate multiple deposits", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });

      const position = await vault.getPosition(user1.address);
      expect(position.ethBalance).to.equal(ethers.parseEther("3"));
    });

    it("should set default risk profile on first deposit", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      const riskProfile = await vault.getRiskProfile(user1.address);
      expect(riskProfile.maxSlippage).to.equal(100); // 1%
      expect(riskProfile.stopLossThreshold).to.equal(1000); // 10%
      expect(riskProfile.allowAutoWithdraw).to.be.true;
    });

    it("should track total deposited", async function () {
      const { vault, user1, user2 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("2") });

      expect(await vault.totalEthDeposited()).to.equal(ethers.parseEther("3"));
    });
  });

  describe("Withdrawals", function () {
    it("should withdraw partial ETH", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("1"))
      ).to.emit(vault, "Withdrawn");

      const position = await vault.getPosition(user1.address);
      expect(position.ethBalance).to.equal(ethers.parseEther("1"));
    });

    it("should withdraw all ETH when amount is 0", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).withdraw(0);

      const position = await vault.getPosition(user1.address);
      expect(position.ethBalance).to.equal(0);
      expect(position.isActive).to.be.false;
    });

    it("should revert on insufficient balance", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).withdraw(ethers.parseEther("2"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("should emergency withdraw all assets", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("5") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(user1).emergencyWithdraw();

      const position = await vault.getPosition(user1.address);
      expect(position.ethBalance).to.equal(0);
      expect(position.isActive).to.be.false;
      expect(position.agentAuthorized).to.be.false;
    });
  });

  describe("Agent Authorization", function () {
    it("should authorize an agent", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).authorizeAgent(0)
      ).to.emit(vault, "AgentAuthorized");

      const position = await vault.getPosition(user1.address);
      expect(position.agentAuthorized).to.be.true;
      expect(position.authorizedAgentId).to.equal(0);
    });

    it("should revoke an agent", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(user1).revokeAgent()
      ).to.emit(vault, "AgentRevoked");

      const position = await vault.getPosition(user1.address);
      expect(position.agentAuthorized).to.be.false;
    });
  });

  describe("Risk Profile", function () {
    it("should update risk profile", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await vault.connect(user1).updateRiskProfile(
        200,   // 2% max slippage
        2000,  // 20% stop loss
        ethers.parseEther("0.5"),  // 0.5 ETH max action
        true,  // allow auto withdraw
        true   // allow auto swap
      );

      const riskProfile = await vault.getRiskProfile(user1.address);
      expect(riskProfile.maxSlippage).to.equal(200);
      expect(riskProfile.stopLossThreshold).to.equal(2000);
      expect(riskProfile.allowAutoSwap).to.be.true;
    });

    it("should reject excessive slippage", async function () {
      const { vault, user1 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });

      await expect(
        vault.connect(user1).updateRiskProfile(1500, 1000, ethers.parseEther("1"), true, false)
      ).to.be.revertedWith("Slippage too high");
    });
  });

  describe("Protection Execution", function () {
    it("should execute emergency withdrawal protection", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      // Setup: user deposits and authorizes agent
      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Rug pull detected on protocol XYZ"));
      const protectValue = ethers.parseEther("1");

      const balanceBefore = await ethers.provider.getBalance(user1.address);

      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0, // EmergencyWithdraw
          protectValue,
          reasonHash
        )
      ).to.emit(vault, "ProtectionExecuted");

      const balanceAfter = await ethers.provider.getBalance(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(protectValue);

      // Check vault stats
      expect(await vault.totalActionsExecuted()).to.equal(1);
      expect(await vault.totalValueProtected()).to.equal(protectValue);
    });

    it("should reject unauthorized agent execution", async function () {
      const { vault, user1, user2 } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("1") });
      await vault.connect(user1).authorizeAgent(0);

      await expect(
        vault.connect(user2).executeProtection(
          user1.address,
          0,
          ethers.parseEther("0.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWith("Not authorized operator");
    });

    it("should reject protection exceeding max action value", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      const depositAmount = ethers.parseEther("2");
      await vault.connect(user1).deposit({ value: depositAmount });
      await vault.connect(user1).authorizeAgent(0);

      // Default max action value is deposit / 2 = 1 ETH
      // Try to protect 1.5 ETH
      await expect(
        vault.connect(agentOperator).executeProtection(
          user1.address,
          0,
          ethers.parseEther("1.5"),
          ethers.ZeroHash
        )
      ).to.be.revertedWith("Exceeds max action value");
    });

    it("should track action history", async function () {
      const { vault, user1, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes("Market crash detected"));

      await vault.connect(agentOperator).executeProtection(
        user1.address,
        2, // AlertOnly
        0,
        reasonHash
      );

      const action = await vault.getAction(0);
      expect(action.agentId).to.equal(0);
      expect(action.user).to.equal(user1.address);
      expect(action.actionType).to.equal(2); // AlertOnly
      expect(action.reasonHash).to.equal(reasonHash);
      expect(action.successful).to.be.true;

      const userActionIds = await vault.getUserActions(user1.address);
      expect(userActionIds.length).to.equal(1);
    });
  });

  describe("Vault Stats", function () {
    it("should return accurate vault statistics", async function () {
      const { vault, user1, user2, agentOperator } = await loadFixture(deployFullFixture);

      await vault.connect(user1).deposit({ value: ethers.parseEther("3") });
      await vault.connect(user2).deposit({ value: ethers.parseEther("2") });
      await vault.connect(user1).authorizeAgent(0);

      await vault.connect(agentOperator).executeProtection(
        user1.address, 0, ethers.parseEther("1"), ethers.ZeroHash
      );

      const stats = await vault.getVaultStats();
      expect(stats[0]).to.equal(ethers.parseEther("4")); // 3+2-1 = 4 ETH
      expect(stats[1]).to.equal(1); // 1 action
      expect(stats[2]).to.equal(ethers.parseEther("1")); // 1 ETH protected
    });
  });
});
