import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("DecisionLogger", function () {
  async function deployLoggerFixture() {
    const [owner, logger1, logger2, user1] = await ethers.getSigners();

    const Logger = await ethers.getContractFactory("DecisionLogger");
    const decisionLogger = await Logger.deploy();

    // Authorize logger1
    await decisionLogger.setLoggerAuthorization(logger1.address, true);

    return { decisionLogger, owner, logger1, logger2, user1 };
  }

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      const { decisionLogger, owner } = await loadFixture(deployLoggerFixture);
      expect(await decisionLogger.owner()).to.equal(owner.address);
    });

    it("should start with zero decisions", async function () {
      const { decisionLogger } = await loadFixture(deployLoggerFixture);
      expect(await decisionLogger.getDecisionCount()).to.equal(0);
    });
  });

  describe("Decision Logging", function () {
    it("should log a decision", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      const analysisHash = ethers.keccak256(ethers.toUtf8Bytes("Risk analysis report"));
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("Input market data"));

      await expect(
        decisionLogger.connect(logger1).logDecision(
          0,              // agentId
          user1.address,  // targetUser
          0,              // RiskAssessment
          1,              // Low risk
          8500,           // 85% confidence
          analysisHash,
          dataHash,
          false,          // no action taken
          0               // no action ID
        )
      ).to.emit(decisionLogger, "DecisionLogged");

      expect(await decisionLogger.getDecisionCount()).to.equal(1);

      const decision = await decisionLogger.getDecision(0);
      expect(decision.agentId).to.equal(0);
      expect(decision.targetUser).to.equal(user1.address);
      expect(decision.riskLevel).to.equal(1); // Low
      expect(decision.confidence).to.equal(8500);
    });

    it("should reject unauthorized loggers", async function () {
      const { decisionLogger, logger2, user1 } = await loadFixture(deployLoggerFixture);

      await expect(
        decisionLogger.connect(logger2).logDecision(
          0, user1.address, 0, 0, 5000, ethers.ZeroHash, ethers.ZeroHash, false, 0
        )
      ).to.be.revertedWith("Not authorized logger");
    });

    it("should emit ThreatDetected event for threats", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      await expect(
        decisionLogger.connect(logger1).logDecision(
          0, user1.address, 1, 4, 9500, // ThreatDetected, Critical risk
          ethers.keccak256(ethers.toUtf8Bytes("Critical threat")),
          ethers.ZeroHash, true, 0
        )
      ).to.emit(decisionLogger, "ThreatDetected");

      expect(await decisionLogger.totalThreatsDetected()).to.equal(1);
    });

    it("should track protection triggers", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      await decisionLogger.connect(logger1).logDecision(
        0, user1.address, 2, 3, 9000, // ProtectionTriggered, High risk
        ethers.ZeroHash, ethers.ZeroHash, true, 42
      );

      expect(await decisionLogger.totalProtectionsTriggered()).to.equal(1);
    });

    it("should index decisions by agent and user", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      // Log 3 decisions
      for (let i = 0; i < 3; i++) {
        await decisionLogger.connect(logger1).logDecision(
          0, user1.address, 0, 0, 5000 + i * 1000,
          ethers.ZeroHash, ethers.ZeroHash, false, 0
        );
      }

      const agentDecisions = await decisionLogger.getAgentDecisions(0);
      expect(agentDecisions.length).to.equal(3);

      const userDecisions = await decisionLogger.getUserDecisions(user1.address);
      expect(userDecisions.length).to.equal(3);
    });
  });

  describe("Risk Snapshots", function () {
    it("should update risk snapshot", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      const detailsHash = ethers.keccak256(ethers.toUtf8Bytes("Detailed risk report"));

      await expect(
        decisionLogger.connect(logger1).updateRiskSnapshot(
          user1.address,
          2,     // Medium risk
          3000,  // 30% liquidation risk
          5000,  // 50% volatility
          1000,  // 10% protocol risk
          500,   // 5% smart contract risk
          detailsHash
        )
      ).to.emit(decisionLogger, "RiskSnapshotUpdated");

      const snapshot = await decisionLogger.getLatestRisk(user1.address);
      expect(snapshot.overallRisk).to.equal(2); // Medium
      expect(snapshot.liquidationRisk).to.equal(3000);
      expect(snapshot.volatilityScore).to.equal(5000);
    });

    it("should maintain risk history", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      // Update snapshot twice
      await decisionLogger.connect(logger1).updateRiskSnapshot(
        user1.address, 1, 1000, 2000, 500, 200, ethers.ZeroHash
      );
      await decisionLogger.connect(logger1).updateRiskSnapshot(
        user1.address, 3, 7000, 8000, 3000, 1500, ethers.ZeroHash
      );

      expect(await decisionLogger.getRiskHistoryCount(user1.address)).to.equal(2);

      const history = await decisionLogger.getRiskHistory(user1.address);
      expect(history[0].overallRisk).to.equal(1); // Low
      expect(history[1].overallRisk).to.equal(3); // High
    });
  });

  describe("View Functions", function () {
    it("should return recent decisions", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      // Log 5 decisions
      for (let i = 0; i < 5; i++) {
        await decisionLogger.connect(logger1).logDecision(
          0, user1.address, 0, i % 5, 5000 + i * 500,
          ethers.ZeroHash, ethers.ZeroHash, false, 0
        );
      }

      const recent = await decisionLogger.getRecentDecisions(3);
      expect(recent.length).to.equal(3);
      // Should be the last 3 (indices 2, 3, 4)
      expect(recent[0].confidence).to.equal(6000);
      expect(recent[1].confidence).to.equal(6500);
      expect(recent[2].confidence).to.equal(7000);
    });

    it("should return aggregate stats", async function () {
      const { decisionLogger, logger1, user1 } = await loadFixture(deployLoggerFixture);

      await decisionLogger.connect(logger1).logDecision(
        0, user1.address, 0, 0, 5000, ethers.ZeroHash, ethers.ZeroHash, false, 0
      );
      await decisionLogger.connect(logger1).logDecision(
        0, user1.address, 1, 4, 9000, ethers.ZeroHash, ethers.ZeroHash, true, 0
      );
      await decisionLogger.connect(logger1).logDecision(
        0, user1.address, 2, 3, 8000, ethers.ZeroHash, ethers.ZeroHash, true, 1
      );

      const stats = await decisionLogger.getStats();
      expect(stats[0]).to.equal(3); // total decisions
      expect(stats[1]).to.equal(1); // threats
      expect(stats[2]).to.equal(1); // protections
    });
  });

  describe("Admin Functions", function () {
    it("should authorize and revoke loggers", async function () {
      const { decisionLogger, owner, logger2 } = await loadFixture(deployLoggerFixture);

      await decisionLogger.setLoggerAuthorization(logger2.address, true);
      expect(await decisionLogger.authorizedLoggers(logger2.address)).to.be.true;

      await decisionLogger.setLoggerAuthorization(logger2.address, false);
      expect(await decisionLogger.authorizedLoggers(logger2.address)).to.be.false;
    });

    it("should reject zero address for logger", async function () {
      const { decisionLogger } = await loadFixture(deployLoggerFixture);

      await expect(
        decisionLogger.setLoggerAuthorization(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Invalid logger");
    });
  });
});
