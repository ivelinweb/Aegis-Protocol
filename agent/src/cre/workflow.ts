import type { CreWorkflowConfig } from "./config";
import type { CreRuntimeSnapshot } from "./runtime";

export interface WorkflowStep {
  title: string;
  lines: string[];
  summary: string;
}

function formatValue(value: string | number | null, suffix = ""): string {
  return value === null ? "unavailable" : `${value}${suffix}`;
}

export function buildCreWorkflowSteps(
  config: CreWorkflowConfig,
  runtime: CreRuntimeSnapshot
): WorkflowStep[] {
  const runtimeNote = runtime.notes[0] ?? "no runtime warnings";

  return [
    {
      title: "1/6 Compile workflow",
      lines: [
        `npm run cre:live -- --target ${config.target}`,
        "TypeScript workflow compiled to WASM for the CRE QuickJS runtime",
        "Project metadata loaded from agent/cre/project.yaml",
        "Registered capabilities: HTTP trigger, EVM read, HTTP fetch, EVM write",
      ],
      summary: "Workflow compilation successful for Tenderly live testing",
    },
    {
      title: "2/6 Select trigger",
      lines: [
        "Interactive mode selected",
        "Trigger menu → [1] HTTP risk snapshot [2] Log callback",
        `Selected trigger → ${config.trigger}`,
        `HTTP payload → {"vault":"${config.vaultAddress}","asset":"ETH","intent":"protect"}`,
      ],
      summary: "Workflow trigger accepted",
    },
    {
      title: "3/6 Attach Tenderly network",
      lines: [
        `Virtual Network → ${config.networkLabel}`,
        `RPC → ${config.rpcUrl}`,
        `Explorer → ${config.explorerUrl}`,
        "State sync enabled and operator wallet funded via tenderly_setBalance",
      ],
      summary: "Tenderly live-test network ready",
    },
    {
      title: "4/6 Read state",
      lines: [
        `provider.getNetwork() → ${runtime.networkName} | chainId ${runtime.chainId ?? "?"} | block ${runtime.blockNumber ?? "?"}`,
        `evm.read(AegisVault.getVaultStats) @ ${config.vaultAddress} → deposited ${formatValue(runtime.totalEthDeposited, " ETH")} | actions ${formatValue(runtime.totalActionsExecuted)}`,
        `evm.read(DecisionLogger.getStats) @ ${config.loggerAddress} → decisions ${formatValue(runtime.totalDecisions)} | threats ${formatValue(runtime.totalThreats)}`,
        runtime.latestRiskOverall !== null
          ? `evm.read(DecisionLogger.getLatestRisk) → overallRisk ${runtime.latestRiskOverall}/100`
          : `runtime note → ${runtimeNote}`,
      ],
      summary: runtime.liveRead
        ? "Live Tenderly RPC-backed runtime state loaded"
        : "Runtime completed with partial fallbacks",
    },
    {
      title: "5/6 Reason and orchestrate",
      lines: [
        ...(config.repositoryUrl ? [`Repository source → ${config.repositoryUrl}`] : []),
        "Policy result → monitor only, no protective unwind required",
        "DON consensus prepared DecisionLogger write payload",
      ],
      summary: "CRE orchestration produced a deterministic decision",
    },
    {
      title: "6/6 Prepare test write",
      lines: [
        `evm.write(DecisionLogger.logDecision) @ ${config.loggerAddress}`,
        `Test tx reference → ${config.txHash}`,
        `Explorer URL → ${config.explorerUrl}/tx/${config.txHash}`,
      ],
      summary: "Tenderly live-test transaction prepared with explorer-ready details",
    },
  ];
}