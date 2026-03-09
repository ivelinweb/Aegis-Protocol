export const VAULT_RUNTIME_ABI = [
  "function getVaultStats() view returns (uint256 totalEthDeposited, uint256 totalActionsExecuted, uint256 totalValueProtected)",
];

export const LOGGER_RUNTIME_ABI = [
  "function getStats() view returns (uint256 totalDecisions, uint256 totalThreats, uint256 totalProtections)",
  "function getLatestRisk(address user) view returns (tuple(uint256 timestamp, uint8 overallRisk, uint256 liquidationRisk, uint256 volatilityScore, uint256 protocolRisk, uint256 smartContractRisk, bytes32 detailsHash))",
];