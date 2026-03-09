export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const DEFAULT_TENDERLY_CHAIN_ID = 9991;
const DEFAULT_TENDERLY_CHAIN_NAME = "Tenderly myEth Mainnet";
const DEFAULT_TENDERLY_RPC_URL =
  "https://virtual.mainnet.eu.rpc.tenderly.co/1a852ec7-470b-4719-83e5-7e4d741e729d";
const DEFAULT_TENDERLY_EXPLORER_URL =
  "https://dashboard.tenderly.co/explorer/vnet/1a852ec7-470b-4719-83e5-7e4d741e729d/transactions";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/transactions\/?$/, "").replace(/\/$/, "");
}

function parseChainId(chainId: string | undefined): number {
  const parsed = Number(chainId ?? DEFAULT_TENDERLY_CHAIN_ID);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TENDERLY_CHAIN_ID;
}

export const TARGET_CHAIN_ID = parseChainId(process.env.NEXT_PUBLIC_CHAIN_ID);
export const PRIMARY_RPC_URL =
  process.env.NEXT_PUBLIC_TENDERLY_PUBLIC_RPC ||
  process.env.NEXT_PUBLIC_ETH_MAINNET_RPC ||
  DEFAULT_TENDERLY_RPC_URL;

// Contract addresses - set these after deploying on the configured Tenderly/EVM network
export const CONTRACTS = {
  REGISTRY: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || ZERO_ADDRESS,
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || ZERO_ADDRESS,
  DECISION_LOGGER: process.env.NEXT_PUBLIC_LOGGER_ADDRESS || ZERO_ADDRESS,
};

export const EXPLORER_CONFIG = {
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME || DEFAULT_TENDERLY_CHAIN_NAME,
  explorerName: process.env.NEXT_PUBLIC_CHAIN_EXPLORER_NAME || "Tenderly Explorer",
  explorerUrl: normalizeBaseUrl(process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL || DEFAULT_TENDERLY_EXPLORER_URL),
  tenderlyExplorerName: process.env.NEXT_PUBLIC_TENDERLY_EXPLORER_NAME || "Tenderly Explorer",
  tenderlyExplorerUrl: normalizeBaseUrl(
    process.env.NEXT_PUBLIC_TENDERLY_EXPLORER_URL || DEFAULT_TENDERLY_EXPLORER_URL
  ),
  repositoryUrl: (process.env.NEXT_PUBLIC_REPOSITORY_URL || "").trim(),
};

export const CHAIN_CONFIG = {
  ethereumMainnet: {
    chainId: `0x${TARGET_CHAIN_ID.toString(16)}`,
    chainName: EXPLORER_CONFIG.chainName,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [PRIMARY_RPC_URL],
    blockExplorerUrls: [EXPLORER_CONFIG.explorerUrl],
  },
};

export const TARGET_CHAIN = CHAIN_CONFIG.ethereumMainnet;
export const TARGET_CHAIN_DECIMAL = TARGET_CHAIN_ID;

export const TARGET_CHAIN_WALLET_PARAMS = {
  chainId: TARGET_CHAIN.chainId,
  chainName: TARGET_CHAIN.chainName,
  nativeCurrency: TARGET_CHAIN.nativeCurrency,
  rpcUrls: TARGET_CHAIN.rpcUrls,
  blockExplorerUrls: TARGET_CHAIN.blockExplorerUrls,
};

export interface DeployedContractSurface {
  key: "REGISTRY" | "VAULT" | "DECISION_LOGGER";
  name: string;
  address: string;
  description: string;
  color: string;
  lines: string;
  sourcePath: string;
}

export const DEPLOYED_CONTRACTS: DeployedContractSurface[] = [
  {
    key: "REGISTRY",
    name: "AegisRegistry",
    address: CONTRACTS.REGISTRY,
    description: "ERC-721 agent identity NFTs with 4-tier system",
    color: "#00e0ff",
    lines: "415 LOC",
    sourcePath: "contracts/AegisRegistry.sol",
  },
  {
    key: "VAULT",
    name: "AegisVault",
    address: CONTRACTS.VAULT,
    description: "Non-custodial vault with agent authorization",
    color: "#a855f7",
    lines: "573 LOC",
    sourcePath: "contracts/AegisVault.sol",
  },
  {
    key: "DECISION_LOGGER",
    name: "DecisionLogger",
    address: CONTRACTS.DECISION_LOGGER,
    description: "Immutable AI decision audit trail",
    color: "#22c55e",
    lines: "338 LOC",
    sourcePath: "contracts/DecisionLogger.sol",
  },
];

export function isConfiguredAddress(address: string): boolean {
  return Boolean(address) && address !== ZERO_ADDRESS;
}

export function getExplorerAddressUrl(address: string): string {
  return `${EXPLORER_CONFIG.explorerUrl}/address/${address}`;
}

export function getExplorerCodeUrl(address: string): string {
  return `${getExplorerAddressUrl(address)}#code`;
}

export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_CONFIG.explorerUrl}/tx/${txHash}`;
}

export function getTenderlyTxUrl(txHash: string): string {
  return `${EXPLORER_CONFIG.tenderlyExplorerUrl}/tx/${txHash}`;
}

export const RISK_LEVELS = ["None", "Low", "Medium", "High", "Critical"] as const;
export const RISK_COLORS = ["#6b7280", "#22c55e", "#eab308", "#f97316", "#ef4444"] as const;
export const ACTION_TYPES = ["Emergency Withdraw", "Rebalance", "Alert Only", "Stop Loss", "Take Profit"] as const;
export const AGENT_TIERS = ["Scout", "Guardian", "Sentinel", "Archon"] as const;
export const AGENT_STATUSES = ["Active", "Paused", "Decommissioned"] as const;
