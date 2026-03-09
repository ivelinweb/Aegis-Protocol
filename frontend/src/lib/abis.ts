// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Contract ABIs for Frontend Integration
// Minimal ABIs for reading on-chain state from the dashboard
// ═══════════════════════════════════════════════════════════════

export const REGISTRY_ABI = [
  // Views
  "function getAgent(uint256 agentId) view returns (tuple(string name, string agentURI, address operator, uint256 registeredAt, uint256 totalDecisions, uint256 successfulActions, uint256 totalValueProtected, uint8 status, uint8 tier))",
  "function getAgentCount() view returns (uint256)",
  "function getReputationScore(uint256 agentId) view returns (uint256)",
  "function getSuccessRate(uint256 agentId) view returns (uint256)",
  "function getReputationCount(uint256 agentId) view returns (uint256)",
  "function isAgentActive(uint256 agentId) view returns (bool)",
  "function hasAgent(address operator) view returns (bool)",
  "function operatorToAgent(address operator) view returns (uint256)",
  // Write
  "function registerAgent(string name, string agentURI, uint8 tier) payable returns (uint256)",
  "function giveFeedback(uint256 agentId, uint8 score, string comment)",
];

export const VAULT_ABI = [
  // Views
  "function getPosition(address user) view returns (tuple(uint256 ethBalance, uint256 depositTimestamp, uint256 lastActionTimestamp, bool isActive, uint256 authorizedAgentId, bool agentAuthorized, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function getUserDepositETH(address user) view returns (uint256)",
  "function getVaultStats() view returns (uint256 totalEthDeposited, uint256 totalActionsExecuted, uint256 totalValueProtected)",
  "function getAction(uint256 actionId) view returns (tuple(uint256 agentId, address user, uint8 actionType, uint256 value, uint256 timestamp, bytes32 reasonHash, bool successful))",
  "function getActionCount() view returns (uint256)",
  "function getUserActions(address user) view returns (uint256[])",
  "function totalEthDeposited() view returns (uint256)",
  "function totalActionsExecuted() view returns (uint256)",
  "function totalValueProtected() view returns (uint256)",
  // Write
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function authorizeAgent(uint256 agentId)",
  "function revokeAgent()",
  "function updateRiskProfile(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap)",
  "function emergencyWithdraw()",
  // Events
  "event Deposited(address indexed user, uint256 amount, uint256 timestamp)",
  "event ETHDeposited(address indexed user, uint256 amount)",
  "event ProtectionExecuted(uint256 indexed actionId, uint256 indexed agentId, address indexed user, uint8 actionType, uint256 value, bytes32 reasonHash, bool successful)",
];

export const LOGGER_ABI = [
  // Views
  "function authorizedLoggers(address logger) view returns (bool)",
  "function getDecisionCount() view returns (uint256)",
  "function getDecision(uint256 decisionId) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId))",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId)[])",
  "function getLatestRisk(address user) view returns (tuple(uint256 timestamp, uint8 overallRisk, uint256 liquidationRisk, uint256 volatilityScore, uint256 protocolRisk, uint256 smartContractRisk, bytes32 detailsHash))",
  "function getStats() view returns (uint256 totalDecisions, uint256 totalThreats, uint256 totalProtections)",
  "function getUserDecisions(address user) view returns (uint256[])",
  "function totalThreatsDetected() view returns (uint256)",
  "function totalProtectionsTriggered() view returns (uint256)",
  // Write
  "function logDecision(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, bool actionTaken, uint256 actionId) returns (uint256)",
];
