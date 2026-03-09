import type { LiveMarketData } from "@/lib/useLiveMarket";
import { EXPLORER_CONFIG, PRIMARY_RPC_URL } from "@/lib/constants";
import { loadCreRuntimeState, type CreRuntimeState } from "@/lib/creRuntime";

export type SimulationMode = "guardian" | "cre";

export interface CreSimulationData {
  lines: string[];
  summary: string;
  liveRead?: boolean;
}

export interface CreSimulationMeta {
  workflowId: string;
  target: string;
  trigger: string;
  networkLabel: string;
  rpcUrl: string;
  explorerUrl: string;
  vaultAddress: string;
  loggerAddress: string;
}

function withFallbackAddress(address: string | undefined, fallback: string): string {
  return address && address !== "0x0000000000000000000000000000000000000000" ? address : fallback;
}

export function getCreSimulationMeta(): CreSimulationMeta {
  const workflowId = process.env.NEXT_PUBLIC_CRE_WORKFLOW_ID ?? "aegis-cre-tenderly-myeth-mainnet";
  const target = process.env.NEXT_PUBLIC_CRE_TARGET ?? "tenderly-myeth-mainnet";
  const trigger = process.env.NEXT_PUBLIC_CRE_TRIGGER ?? "HTTP trigger";
  const networkLabel = process.env.NEXT_PUBLIC_TENDERLY_VIRTUAL_TESTNET_NAME ?? "Tenderly myEth Mainnet";
  const rpcUrl = process.env.NEXT_PUBLIC_TENDERLY_PUBLIC_RPC ?? PRIMARY_RPC_URL;
  const explorerUrl = EXPLORER_CONFIG.tenderlyExplorerUrl;
  const vaultAddress = withFallbackAddress(
    process.env.NEXT_PUBLIC_VAULT_ADDRESS,
    "0xA39e5F0f6A90fB8F4dF6Ff4eBfA8d97e2f31C0de"
  );
  const loggerAddress = withFallbackAddress(
    process.env.NEXT_PUBLIC_LOGGER_ADDRESS,
    "0xDEC15A0A10F9E12A6D4A7D7C21B4E61A91FBEE0F"
  );

  return { workflowId, target, trigger, networkLabel, rpcUrl, explorerUrl, vaultAddress, loggerAddress };
}

function formatReadValue(value: string | number | null, suffix = ""): string {
  if (value === null) {
    return "unavailable";
  }

  return `${value}${suffix}`;
}

export async function generateCrePhaseData(
  phaseKey: string,
  market: LiveMarketData,
  runtimeState?: CreRuntimeState | null
): Promise<CreSimulationData> {
  const meta = getCreSimulationMeta();
  const ethPrice = market.ethPriceCoinGecko > 0 ? market.ethPriceCoinGecko : 3200;
  const tvl = market.ethereumTvl > 0 ? (market.ethereumTvl / 1e9).toFixed(2) : "52.00";
  const uniswap = market.ethPriceUniswap > 0 ? market.ethPriceUniswap : 3198.8;
  const delta = market.priceDelta > 0 ? market.priceDelta.toFixed(3) : "0.038";

  switch (phaseKey) {
    case "compile":
      return {
        lines: [
          `> npm run cre:live -- --target ${meta.target}`,
          "> TypeScript workflow compiled to WASM (QuickJS runtime)",
          "> Registered handlers: HTTP trigger, EVM read, HTTP fetch, EVM write",
          `> Target network: ${meta.networkLabel}`,
        ],
        summary: "Workflow compiled and CRE handlers registered for Tenderly live testing",
      };
    case "trigger":
      return {
        lines: [
          "> Trigger selection menu:",
          "> [1] HTTP risk snapshot  [2] EVM log callback",
          `> Selected: ${meta.trigger}`,
          `> Payload: {\"vault\":\"${meta.vaultAddress}\",\"asset\":\"ETH\",\"intent\":\"protect\"}`,
        ],
        summary: "Interactive trigger payload accepted for the Tenderly live test",
      };
    case "network":
      return {
        lines: [
          `> Tenderly Virtual Network: ${meta.networkLabel}`,
          `> Public RPC: ${meta.rpcUrl}`,
          `> Explorer: ${meta.explorerUrl}`,
          "> State sync enabled → mirroring Ethereum mainnet state",
          "> Funding operator wallet via tenderly_setBalance(...)",
        ],
        summary: "Tenderly virtual network attached and operator wallet prepared",
      };
    case "read": {
      const runtime = runtimeState ?? (await loadCreRuntimeState());
      const runtimeNote = runtime.warnings[0];

      return {
        lines: [
          `> rpc.connect(${runtime.rpcUrl}) → ${runtime.liveRead ? "live Tenderly-compatible runtime" : "partial runtime connectivity"}`,
          `> provider.getNetwork() → ${runtime.networkName} | chainId ${runtime.chainId ?? "?"} | block ${runtime.blockNumber ?? "?"}`,
          `> evm.read(AegisVault.getVaultStats) @ ${meta.vaultAddress} → deposited ${formatReadValue(runtime.totalEthDeposited, " ETH")} | actions ${formatReadValue(runtime.totalActionsExecuted)}`,
          `> evm.read(DecisionLogger.getStats) @ ${meta.loggerAddress} → decisions ${formatReadValue(runtime.totalDecisions)} | threats ${formatReadValue(runtime.totalThreats)}`,
          `> fetch("coingecko/ethereum") → $${ethPrice.toFixed(2)}`,
          `> fetch("uniswap/v2/price") → $${uniswap.toFixed(2)} | delta ${delta}%`,
          runtime.latestRiskOverall !== null
            ? `> evm.read(DecisionLogger.getLatestRisk) → overallRisk ${runtime.latestRiskOverall}/100`
            : `> runtime note: ${runtimeNote ?? `fallback TVL context ${tvl}B from DeFiLlama`}`,
        ],
        summary: runtime.liveRead
          ? "Live Tenderly RPC-backed runtime state loaded into CRE context"
          : "Runtime context loaded with graceful RPC fallbacks",
        liveRead: runtime.liveRead,
      };
    }
    case "reason":
      return {
        lines: [
          "> HTTP capability → CoinGecko + DeFiLlama + Tenderly explorer metadata",
          "> Risk policy: protect user funds on extreme volatility or oracle divergence",
          `> LLM summary: ETH at $${ethPrice.toFixed(2)} with oracle delta ${delta}% remains within safe guardrails`,
          "> DON orchestration prepared a monitor-only write plan for DecisionLogger",
        ],
        summary: "CRE orchestration produced a deterministic protection decision",
      };
    case "execute":
      return {
        lines: [
          `> evm.write(DecisionLogger.logDecision) @ ${meta.loggerAddress}`,
          "> Auth mode: connected browser wallet signer",
          "> Waiting for the dashboard runtime to request a signature and submit the live write",
          "> Tenderly Explorer link will resolve from the real transaction hash after confirmation",
        ],
        summary: "Execution is delegated to the live browser-wallet write path",
      };
    default:
      return { lines: [], summary: "" };
  }
}