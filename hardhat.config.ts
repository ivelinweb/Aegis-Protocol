import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

function normalizePrivateKey(privateKey: string | undefined): string | undefined {
  if (!privateKey) return undefined;
  return privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const PRIVATE_KEY = normalizePrivateKey(process.env.PRIVATE_KEY);
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const TENDERLY_VNET_RPC_URL =
  process.env.TENDERLY_VIRTUAL_TESTNET_RPC ||
  process.env.TENDERLY_RPC_URL ||
  process.env.ETH_MAINNET_RPC ||
  "https://virtual.mainnet.eu.rpc.tenderly.co/1a852ec7-470b-4719-83e5-7e4d741e729d";
const TENDERLY_VNET_CHAIN_ID = parsePositiveInt(
  process.env.TENDERLY_VIRTUAL_TESTNET_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID,
  9991
);
const SHARED_ACCOUNTS = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mainnet: {
      url: process.env.ETH_MAINNET_RPC || "https://ethereum-rpc.publicnode.com",
      chainId: 1,
      accounts: SHARED_ACCOUNTS,
    },
    tenderlyVnet: {
      url: TENDERLY_VNET_RPC_URL,
      chainId: TENDERLY_VNET_CHAIN_ID,
      accounts: SHARED_ACCOUNTS,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
    },
  },
  sourcify: {
    enabled: true,
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
