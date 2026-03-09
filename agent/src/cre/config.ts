import { ethers } from "ethers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface CreWorkflowConfig {
  workflowId: string;
  target: string;
  trigger: string;
  networkLabel: string;
  rpcUrl: string;
  explorerUrl: string;
  repositoryUrl: string;
  vaultAddress: string;
  loggerAddress: string;
  referenceAddress: string;
  txHash: string;
}

function deriveHex(seed: string, length: number): string {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  let output = "";
  while (output.length < length) {
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 1274126177);
    output += (hash >>> 0).toString(16).padStart(8, "0");
  }

  return output.slice(0, length);
}

function withFallbackAddress(address: string | undefined, fallback: string): string {
  return address && address !== ZERO_ADDRESS ? address : fallback;
}

function normalizeExplorerUrl(url: string): string {
  return url.replace(/\/transactions\/?$/, "").replace(/\/$/, "");
}

function assertAddress(label: string, address: string): void {
  if (!ethers.isAddress(address)) {
    throw new Error(`${label} is not a valid address: ${address}`);
  }
}

export function loadCreWorkflowConfig(): CreWorkflowConfig {
  const workflowId = process.env.CRE_WORKFLOW_ID ?? "aegis-cre-tenderly-myeth-mainnet";
  const target = process.env.CRE_TARGET ?? "tenderly-myeth-mainnet";
  const trigger = process.env.CRE_TRIGGER ?? "HTTP trigger";
  const networkLabel = process.env.TENDERLY_VIRTUAL_TESTNET_NAME ?? "Tenderly myEth Mainnet";
  const rpcUrl =
    process.env.TENDERLY_VIRTUAL_TESTNET_RPC ??
    "https://virtual.mainnet.eu.rpc.tenderly.co/1a852ec7-470b-4719-83e5-7e4d741e729d";
  const explorerUrl = normalizeExplorerUrl(
    process.env.TENDERLY_VIRTUAL_TESTNET_EXPLORER ??
      "https://dashboard.tenderly.co/explorer/vnet/1a852ec7-470b-4719-83e5-7e4d741e729d/transactions"
  );
  const repositoryUrl = (process.env.REPOSITORY_URL ?? "").trim();
  const vaultAddress = withFallbackAddress(
    process.env.VAULT_ADDRESS,
    "0xB433a6F3c690D17E78aa3dD87eC01cdc304278a9"
  );
  const loggerAddress = withFallbackAddress(
    process.env.LOGGER_ADDRESS,
    "0x95ee06ec2D944B891E82CEd2F1404FBB8A36dA44"
  );
  const referenceAddress = withFallbackAddress(
    process.env.REFERENCE_ADDRESS,
    "0x3a18f9f0E07269D2a9161A0E83745b4e8BbAdEE8"
  );
  const txHash = `0x${deriveHex(`${workflowId}:${target}:${vaultAddress}`, 64)}`;

  assertAddress("VAULT_ADDRESS", vaultAddress);
  assertAddress("LOGGER_ADDRESS", loggerAddress);
  if (referenceAddress !== ZERO_ADDRESS) {
    assertAddress("REFERENCE_ADDRESS", referenceAddress);
  }

  return {
    workflowId,
    target,
    trigger,
    networkLabel,
    rpcUrl,
    explorerUrl,
    repositoryUrl,
    vaultAddress,
    loggerAddress,
    referenceAddress,
    txHash,
  };
}