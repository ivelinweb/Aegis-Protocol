"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import type { LiveMarketData } from "@/lib/useLiveMarket";
import {
  generateCrePhaseData,
  getCreSimulationMeta,
  type SimulationMode,
} from "@/lib/creSimulation";
import { loadCreRuntimeState, type CreRuntimeState } from "@/lib/creRuntime";
import type { ContractWriteResult, DecisionLogInput } from "@/lib/useContracts";
import {
  Eye,
  Activity,
  Cpu,
  BarChart3,
  AlertTriangle,
  Zap,
  CheckCircle,
  Shield,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface AgentSimulationProps {
  market: LiveMarketData;
  isWalletConnected: boolean;
  walletAddress: string | null;
  executeCreWrite: (input: DecisionLogInput) => Promise<ContractWriteResult>;
}

interface CreExecutionResult {
  txHash: string;
  blockNumber: number | null;
  status: number | null;
  explorerUrl: string;
}

interface PhaseConfig {
  id: number;
  key: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  duration: number; // ms
}

const GUARDIAN_PHASES: PhaseConfig[] = [
  { id: 0, key: "observe",  label: "OBSERVE",    sub: "Fetching Market Data",       icon: Eye,            color: "#00e0ff", duration: 2800 },
  { id: 1, key: "analyze",  label: "ANALYZE",    sub: "5-Vector Risk Engine",       icon: Activity,       color: "#a855f7", duration: 3200 },
  { id: 2, key: "reason",   label: "AI REASON",  sub: "LLM Inference (Groq)",       icon: Cpu,            color: "#f97316", duration: 3800 },
  { id: 3, key: "verify",   label: "DEX VERIFY", sub: "Uniswap Cross-Check",        icon: BarChart3,      color: "#f0b90b", duration: 2500 },
  { id: 4, key: "decide",   label: "DECIDE",     sub: "Threat Assessment",          icon: AlertTriangle,  color: "#ef4444", duration: 2200 },
  { id: 5, key: "execute",  label: "EXECUTE",    sub: "On-Chain Action",            icon: Zap,            color: "#22c55e", duration: 2000 },
];

const CRE_PHASES: PhaseConfig[] = [
  { id: 0, key: "compile", label: "COMPILE", sub: "TypeScript → WASM", icon: Cpu, color: "#00e0ff", duration: 2200 },
  { id: 1, key: "trigger", label: "TRIGGER", sub: "Interactive Input", icon: Activity, color: "#a855f7", duration: 2200 },
  { id: 2, key: "network", label: "NETWORK", sub: "Tenderly myEth", icon: Shield, color: "#f97316", duration: 2200 },
  { id: 3, key: "read", label: "READ", sub: "EVM + Market State", icon: Eye, color: "#f0b90b", duration: 2400 },
  { id: 4, key: "reason", label: "ORCHESTRATE", sub: "CRE Decision Plan", icon: BarChart3, color: "#ef4444", duration: 2600 },
  { id: 5, key: "execute", label: "WRITE", sub: "Tenderly Test Write", icon: Zap, color: "#22c55e", duration: 2200 },
];

function TypewriterText({ text, speed = 18 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;
    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current <= text.length) {
        setDisplayed(text.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && <span className="animate-pulse text-[#00e0ff]">▌</span>}
    </span>
  );
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getCreDecisionPayload(market: LiveMarketData, walletAddress: string): DecisionLogInput {
  const absoluteChange = Math.abs(market.priceChange24h);
  const priceDelta = Math.abs(market.priceDelta);
  const riskLevel = absoluteChange > 10 ? 4 : absoluteChange > 5 || priceDelta > 1 ? 3 : absoluteChange > 3 || priceDelta > 0.5 ? 2 : 1;
  const decisionType = riskLevel >= 3 ? 1 : riskLevel === 2 ? 4 : 3;
  const confidence = riskLevel >= 3 ? 9700 : riskLevel === 2 ? 9450 : 9200;
  const analysisHash = ethers.id(
    `cre-analysis:${walletAddress}:${market.ethPriceCoinGecko}:${market.priceChange24h}:${market.priceDelta}`
  );
  const dataHash = ethers.id(
    `cre-input:${walletAddress}:${market.ethPriceUniswap}:${market.ethereumTvl}:${market.volume24h}`
  );

  return {
    agentId: 0,
    targetUser: walletAddress,
    decisionType,
    riskLevel,
    confidence,
    analysisHash,
    dataHash,
    actionTaken: false,
    actionId: 0,
  };
}

// ─── Simulation Data Generators ───────────────────────────────
function generateObserveData(market: LiveMarketData) {
  if (market.ethPriceCoinGecko > 0) {
    return {
      lines: [
        `> fetch("coingecko/ethereum") → $${market.ethPriceCoinGecko.toFixed(2)}`,
        `> fetch("defillama/ethereum") → TVL $${(market.ethereumTvl / 1e9).toFixed(2)}B`,
        `> fetch("uniswap/v2/price") → $${market.ethPriceUniswap > 0 ? market.ethPriceUniswap.toFixed(2) : "querying..."}`,
        `> 24h Change: ${market.priceChange24h >= 0 ? "+" : ""}${market.priceChange24h.toFixed(2)}%`,
        `> Volume: $${(market.volume24h / 1e9).toFixed(2)}B | Market Cap: $${(market.marketCap / 1e9).toFixed(1)}B`,
      ],
      summary: `Data collected: ETH at $${market.ethPriceCoinGecko.toFixed(2)}, Ethereum TVL $${(market.ethereumTvl / 1e9).toFixed(2)}B`,
    };
  }
  return {
    lines: [
      '> fetch("coingecko/ethereum") → $3200.00',
      '> fetch("defillama/ethereum") → TVL $52.00B',
      '> fetch("uniswap/v2/price") → $3198.80',
      "> 24h Change: +1.82%",
      "> Volume: $12.40B | Market Cap: $385.0B",
    ],
    summary: "Data collected: ETH at $3200.00, Ethereum TVL $52.00B",
  };
}

function generateAnalyzeData(market: LiveMarketData) {
  const vol = Math.min(100, Math.round(Math.abs(market.priceChange24h) * 8 + 12));
  const liq = Math.min(100, Math.round(Math.abs(market.priceChange24h) * 3 + 8));
  const proto = Math.min(100, Math.round(market.priceDelta * 10 + 5));
  const sc = 12;
  const overall = Math.round((vol * 0.35 + liq * 0.25 + proto * 0.2 + sc * 0.15 + 10 * 0.05));
  return {
    lines: [
      `├─ Liquidation Risk:    ${liq}/100  [${"█".repeat(Math.floor(liq / 5))}${"░".repeat(20 - Math.floor(liq / 5))}]`,
      `├─ Volatility Score:    ${vol}/100  [${"█".repeat(Math.floor(vol / 5))}${"░".repeat(20 - Math.floor(vol / 5))}]`,
      `├─ Protocol Risk:       ${proto}/100  [${"█".repeat(Math.floor(proto / 5))}${"░".repeat(20 - Math.floor(proto / 5))}]`,
      `├─ Smart Contract Risk: ${sc}/100  [${"█".repeat(Math.floor(sc / 5))}${"░".repeat(20 - Math.floor(sc / 5))}]`,
      `└─ Weighted Overall:    ${overall}/100`,
    ],
    summary: `Risk scored: ${overall}/100 (${overall < 25 ? "LOW" : overall < 50 ? "MEDIUM" : overall < 75 ? "HIGH" : "CRITICAL"})`,
    overall,
  };
}

function generateReasonData(market: LiveMarketData) {
  const change = market.priceChange24h;
  const delta = market.priceDelta;
  let reasoning: string;

  if (Math.abs(change) > 5 && delta > 1) {
    reasoning = `THREAT DETECTED: ETH showing ${change.toFixed(2)}% volatility with ${delta.toFixed(3)}% oracle divergence. Volume anomaly suggests potential manipulation. Recommending defensive posture with stop-loss tightening.`;
  } else if (Math.abs(change) > 3) {
    reasoning = `ELEVATED VOLATILITY: ETH moved ${change >= 0 ? "+" : ""}${change.toFixed(2)}% in 24h. Volume at $${(market.volume24h / 1e9).toFixed(2)}B. Oracle cross-check shows ${delta.toFixed(3)}% delta — within normal range. Monitoring closely but no action needed.`;
  } else {
    reasoning = `ALL CLEAR: Market stable with ETH at $${market.ethPriceCoinGecko > 0 ? market.ethPriceCoinGecko.toFixed(2) : "3200.00"}. 24h change ${change >= 0 ? "+" : ""}${change.toFixed(2)}% is within normal parameters. Ethereum TVL healthy at $${(market.ethereumTvl / 1e9).toFixed(2)}B. No threats detected.`;
  }

  return {
    lines: [
      "> groq.chat.completions.create({",
      '>   model: "llama-3.3-70b-versatile",',
      ">   messages: [systemPrompt, marketData],",
      "> })",
      "",
      `AI: "${reasoning}"`,
    ],
    summary: reasoning.split(":")[0],
    reasoning,
  };
}

function generateVerifyData(market: LiveMarketData) {
  const cg = market.ethPriceCoinGecko > 0 ? market.ethPriceCoinGecko : 3200.0;
  const dex = market.ethPriceUniswap > 0 ? market.ethPriceUniswap : 3198.8;
  const delta = market.priceDelta > 0 ? market.priceDelta : 0.038;
  const status = delta < 1 ? "✓ CONSISTENT" : delta < 5 ? "⚠ DIVERGENCE" : "🚨 CRITICAL";

  return {
    lines: [
      `> Uniswap V2 Router: 0x7a25...2488D`,
      `> getAmountsOut(1 WETH → DAI) = $${dex.toFixed(2)}`,
      `> CoinGecko API price:           $${cg.toFixed(2)}`,
      `> Delta: ${delta.toFixed(3)}%  →  ${status}`,
      delta < 1
        ? "> No oracle manipulation indicators detected"
        : "> WARNING: Price divergence exceeds threshold",
    ],
    summary: `Oracle check: ${status} (Δ${delta.toFixed(3)}%)`,
  };
}

function generateDecideData(market: LiveMarketData) {
  const change = Math.abs(market.priceChange24h);
  const delta = market.priceDelta;
  const risk = change > 10 ? "CRITICAL" : change > 5 ? "HIGH" : change > 3 ? "MEDIUM" : delta > 1 ? "MEDIUM" : "LOW";
  const confidence = Math.min(99, Math.round(85 + Math.random() * 12));
  const action = risk === "CRITICAL" || risk === "HIGH" ? "PROTECT" : "MONITOR";

  return {
    lines: [
      `> Threat Level:  ${risk}`,
      `> Confidence:    ${confidence}%`,
      `> Action:        ${action}`,
      `> Risk Factors:  volatility(${change.toFixed(1)}%), oracle_delta(${delta.toFixed(3)}%)`,
      action === "PROTECT"
        ? "> → Triggering emergency stop-loss at 95% threshold"
        : "> → Continue monitoring, next cycle in 30s",
    ],
    summary: `Decision: ${action} (${risk} risk, ${confidence}% confidence)`,
    action,
    risk,
  };
}

function generateExecuteData(action: string, risk: string) {
  if (action === "PROTECT") {
    return {
      lines: [
        "> Executing on-chain protection...",
        `> logDecision(type=2, risk=${risk}, confidence=96%)`,
        `> TX: 0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}...`,
        "> ✓ Decision logged on DecisionLogger",
        "> ✓ Stop-loss triggered on AegisVault",
      ],
      summary: "Protection executed and logged on-chain",
    };
  }
  return {
    lines: [
      "> No action required — monitoring continues",
      `> logDecision(type=0, risk=${risk}, confidence=94%)`,
      `> TX: 0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}...`,
      "> ✓ All-clear logged on DecisionLogger",
      "> ⏳ Next cycle starts in 30 seconds...",
    ],
    summary: "All-clear logged on-chain, cycle complete",
  };
}

// ─── Main Component ───────────────────────────────────────────
export default function AgentSimulation({
  market,
  isWalletConnected,
  walletAddress,
  executeCreWrite,
}: AgentSimulationProps) {
  const [mode, setMode] = useState<SimulationMode>("cre");
  const [activePhase, setActivePhase] = useState(-1); // -1 = idle
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentLines, setCurrentLines] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [phaseSummary, setPhaseSummary] = useState("");
  const [decisionAction, setDecisionAction] = useState("MONITOR");
  const [decisionRisk, setDecisionRisk] = useState("LOW");
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const [creExecutionResult, setCreExecutionResult] = useState<CreExecutionResult | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const creRuntimeRef = useRef<CreRuntimeState | null>(null);
  const activePhases = mode === "cre" ? CRE_PHASES : GUARDIAN_PHASES;
  const creMeta = getCreSimulationMeta();

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const resetSimulation = useCallback(() => {
    setActivePhase(-1);
    setIsRunning(false);
    setLogs([]);
    setCurrentLines([]);
    setLineIndex(0);
    setPhaseSummary("");
    setCompletedPhases([]);
    setCreExecutionResult(null);
    creRuntimeRef.current = null;
  }, []);

  const revealLine = useCallback(async (line: string, delayMs: number) => {
    await new Promise<void>((resolve) => {
      timerRef.current = setTimeout(() => {
        setCurrentLines((prev) => [...prev, line]);
        setLineIndex((prev) => prev + 1);
        resolve();
      }, delayMs);
    });
  }, []);

  const runCreExecutePhase = useCallback(async (phaseId: number): Promise<CreExecutionResult> => {
    const phase = activePhases[phaseId];
    setActivePhase(phaseId);
    setLineIndex(0);
    setCurrentLines([]);
    setPhaseSummary("");
    addLog(`▶ CRE ${phaseId + 1}/${activePhases.length}: ${phase.label} — ${phase.sub}`);

    if (!isWalletConnected || !walletAddress) {
      throw new Error("Connect an authorized browser wallet before running the CRE write");
    }

    await revealLine(`> evm.write(DecisionLogger.logDecision) @ ${creMeta.loggerAddress}`, 220);
    await revealLine("> Auth mode: connected browser wallet signer", 220);
    await revealLine(`> Requesting signature from ${shortAddress(walletAddress)}`, 220);

    try {
      const result = await executeCreWrite(getCreDecisionPayload(market, walletAddress));
      setCreExecutionResult(result);

      await revealLine(`> Tx hash: ${result.txHash}`, 220);
      await revealLine(`> Explorer URL: ${result.explorerUrl}`, 220);
      await revealLine(
        `> Receipt: ${result.status === 1 ? "confirmed" : `status ${result.status ?? "unknown"}`} | block ${result.blockNumber ?? "?"}`,
        220
      );

      const summary = `Browser-wallet CRE write confirmed${result.blockNumber ? ` in block ${result.blockNumber}` : ""}`;
      setPhaseSummary(summary);
      setCompletedPhases((prev) => [...prev, phaseId]);
      addLog(`✓ ${phase.label} complete: ${summary}`);
      await new Promise((r) => setTimeout(r, 600));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "CRE write failed";
      await revealLine(`> ERROR: ${message}`, 180);
      setPhaseSummary("CRE write failed");
      addLog(`✗ ${phase.label} failed: ${message}`);
      throw error;
    }
  }, [activePhases, addLog, creMeta.loggerAddress, executeCreWrite, isWalletConnected, market, revealLine, walletAddress]);

  const runPhase = useCallback(
    async (phaseId: number): Promise<CreExecutionResult | null> => {
      const phase = activePhases[phaseId];

      if (mode === "cre" && phase.key === "execute") {
        return runCreExecutePhase(phaseId);
      }

      setActivePhase(phaseId);
      setLineIndex(0);
      setCurrentLines([]);
      setPhaseSummary("");
      addLog(`▶ ${mode === "cre" ? "CRE" : "Phase"} ${phaseId + 1}/${activePhases.length}: ${phase.label} — ${phase.sub}`);

      let data: { lines: string[]; summary: string; action?: string; risk?: string; liveRead?: boolean };

      if (mode === "cre") {
        if (phase.key === "read" && !creRuntimeRef.current) {
          creRuntimeRef.current = await loadCreRuntimeState();
        }

        data = await generateCrePhaseData(phase.key, market, creRuntimeRef.current);

        if (phase.key === "read" && data.liveRead === false) {
          addLog("⚠ CRE READ completed with partial RPC data — check Tenderly/public RPC env configuration");
        }
      } else {
        switch (phase.key) {
          case "observe":
            data = generateObserveData(market);
            break;
          case "analyze":
            data = generateAnalyzeData(market);
            break;
          case "reason":
            data = generateReasonData(market);
            break;
          case "verify":
            data = generateVerifyData(market);
            break;
          case "decide": {
            const d = generateDecideData(market);
            data = d;
            setDecisionAction(d.action);
            setDecisionRisk(d.risk);
            break;
          }
          case "execute":
            data = generateExecuteData(decisionAction, decisionRisk);
            break;
          default:
            data = { lines: [], summary: "" };
        }
      }

      // Reveal lines progressively
      for (let i = 0; i < data.lines.length; i++) {
        await revealLine(data.lines[i], phase.duration / data.lines.length);
      }

      // Phase complete
      setPhaseSummary(data.summary);
      setCompletedPhases((prev) => [...prev, phaseId]);
      addLog(`✓ ${phase.label} complete: ${data.summary}`);

      // Brief pause before next phase
      await new Promise((r) => setTimeout(r, 600));
      return null;
    },
    [market, addLog, decisionAction, decisionRisk, mode, activePhases, revealLine, runCreExecutePhase]
  );

  const startCycle = useCallback(async () => {
    setIsRunning(true);
    setCompletedPhases([]);
    setCreExecutionResult(null);
    setCycleCount((c) => c + 1);
    addLog(mode === "cre" ? "═══ Starting CRE Workflow Live Test ═══" : "═══ Starting Agent Cycle ═══");

    try {
      let latestCreExecution: CreExecutionResult | null = null;
      for (let i = 0; i < activePhases.length; i++) {
        const phaseResult = await runPhase(i);
        if (phaseResult) {
          latestCreExecution = phaseResult;
        }
      }

      const txHash = latestCreExecution ? latestCreExecution.txHash : null;
      addLog(
        mode === "cre"
          ? txHash
            ? `═══ CRE Live Test Complete — Tx ${txHash.slice(0, 10)}... ═══`
            : "═══ CRE Live Test Complete ═══"
          : "═══ Cycle Complete — Next in 30s ═══"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed";
      addLog(`✗ ${mode === "cre" ? "CRE workflow" : "Agent cycle"} failed: ${message}`);
    } finally {
      setActivePhase(-1);
      setIsRunning(false);
    }
  }, [activePhases.length, addLog, mode, runPhase]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00e0ff]" />
            {mode === "cre" ? "CRE Workflow Live Test" : "Live Agent Simulation"}
            {isRunning && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                RUNNING
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            {mode === "cre"
              ? `Run a Chainlink Runtime Environment live test against ${creMeta.networkLabel}; the final WRITE phase is authenticated and signed by the connected browser wallet`
              : `Watch Aegis execute a full 6-phase guardian cycle with ${market.ethPriceCoinGecko > 0 ? "live market data" : "simulated data"}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/10 bg-black/20 p-1">
            {[
              { key: "guardian", label: "Guardian" },
              { key: "cre", label: "CRE + Tenderly Live" },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => {
                  if (isRunning) return;
                  setMode(option.key as SimulationMode);
                  resetSimulation();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  mode === option.key
                    ? "bg-[#00e0ff]/15 text-[#00e0ff]"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {mode === "cre" && (
            <span className={`text-[11px] ${isWalletConnected && walletAddress ? "text-green-400" : "text-yellow-400"}`}>
              {isWalletConnected && walletAddress
                ? `Wallet signer: ${shortAddress(walletAddress)}`
                : "Connect wallet to enable authenticated CRE execution"}
            </span>
          )}
          {cycleCount > 0 && (
            <span className="text-xs text-gray-500 font-mono">Cycles: {cycleCount}</span>
          )}
          <button
            onClick={startCycle}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              isRunning
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-[#00e0ff]/20 to-[#a855f7]/20 text-[#00e0ff] border border-[#00e0ff]/30 hover:border-[#00e0ff]/60 hover:scale-[1.02]"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> {mode === "cre" ? "Run CRE Workflow" : "Run Agent Cycle"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="flex items-center justify-between gap-1 mb-6 overflow-x-auto pb-2">
        {activePhases.map((phase, i) => {
          const isActive = activePhase === i;
          const isComplete = completedPhases.includes(i);
          const Icon = phase.icon;

          return (
            <div key={phase.key} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`relative flex flex-col items-center p-3 rounded-xl min-w-[100px] transition-all duration-500 ${
                  isActive ? "scale-105 ring-1" : ""
                }`}
                style={{
                  background: isActive
                    ? `${phase.color}18`
                    : isComplete
                    ? `${phase.color}0a`
                    : "rgba(0,0,0,0.2)",
                  border: `1px solid ${
                    isActive ? `${phase.color}60` : isComplete ? `${phase.color}30` : "rgba(255,255,255,0.03)"
                  }`,
                  ...(isActive ? { boxShadow: `0 0 15px ${phase.color}20` } : {}),
                }}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl animate-pulse opacity-20"
                    style={{ background: phase.color }}
                  />
                )}
                <div className="relative">
                  {isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: phase.color }} />
                  ) : isComplete ? (
                    <CheckCircle className="w-5 h-5" style={{ color: phase.color }} />
                  ) : (
                    <Icon className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <p
                  className="text-[10px] font-bold mt-1.5 tracking-wider"
                  style={{ color: isActive || isComplete ? phase.color : "#6b7280" }}
                >
                  {phase.label}
                </p>
                <p className="text-[9px] text-gray-600 mt-0.5">{phase.sub}</p>
              </div>
              {i < activePhases.length - 1 && (
                <ArrowRight
                  className="w-3 h-3 flex-shrink-0 hidden sm:block"
                  style={{ color: isComplete ? activePhases[i + 1].color : "#374151" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Live Output Terminal */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Phase Output */}
        <div
          className="rounded-xl p-4 font-mono text-xs min-h-[200px] max-h-[280px] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,224,255,0.1)" }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600 text-[10px] ml-2">
              {activePhase >= 0
                ? `${mode === "cre" ? "cre-runtime" : "aegis-agent"}/${activePhases[activePhase].key}`
                : `${mode === "cre" ? "cre-runtime" : "aegis-agent"}/idle`}
            </span>
          </div>

          {activePhase < 0 && currentLines.length === 0 && (
            <div className="text-gray-600 flex items-center gap-2 mt-8 justify-center">
              <Shield className="w-4 h-4" />
              <span>Click &quot;{mode === "cre" ? "Run CRE Workflow" : "Run Agent Cycle"}&quot; to start</span>
            </div>
          )}

          {currentLines.map((line, i) => (
            <div key={i} className="leading-relaxed" style={{ color: i === lineIndex - 1 ? "#e2e8f0" : "#9ca3af" }}>
              {i === currentLines.length - 1 ? <TypewriterText text={line} speed={12} /> : line}
            </div>
          ))}

          {phaseSummary && (
            <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(0,224,255,0.1)" }}>
              <span className="text-green-400">✓ {phaseSummary}</span>
            </div>
          )}
        </div>

        {/* Running Log */}
        <div
          className="rounded-xl p-4 font-mono text-[11px] min-h-[200px] max-h-[280px] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,85,247,0.1)" }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <Activity className="w-3 h-3 text-purple-400" />
            <span className="text-gray-600 text-[10px]">terminal-activity</span>
          </div>

          {logs.length === 0 && (
            <div className="text-gray-600 flex items-center gap-2 mt-8 justify-center">
              <Activity className="w-4 h-4" />
              <span>{mode === "cre" ? "CRE execution log will appear here" : "Agent log will appear here"}</span>
            </div>
          )}

          {logs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed ${
                log.includes("═══") ? "text-[#00e0ff] font-bold mt-1" : log.includes("✓") ? "text-green-400" : "text-gray-500"
              }`}
            >
              {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Phase Stats Bar */}
      {completedPhases.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Phases: {completedPhases.length}/{activePhases.length}</span>
            <span>|</span>
            {mode === "cre" ? (
              <>
                <span>
                  Target: <span className="text-green-400">{creMeta.target}</span>
                </span>
                <span>|</span>
                <span>
                  Auth: <span className={isWalletConnected ? "text-green-400" : "text-yellow-400"}>{isWalletConnected ? "Browser wallet" : "Not connected"}</span>
                </span>
              </>
            ) : (
              <span>
                Data:{" "}
                {market.ethPriceCoinGecko > 0 ? (
                  <span className="text-green-400">Live (CoinGecko + Uniswap)</span>
                ) : (
                  <span className="text-yellow-400">Simulated</span>
                )}
              </span>
            )}
          </div>
          {completedPhases.length === activePhases.length && (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" />
              {mode === "cre"
                ? creExecutionResult
                  ? `Explorer confirmed — ${creExecutionResult.txHash.slice(0, 10)}...`
                  : "Workflow complete"
                : "Cycle complete — all phases executed"}
            </div>
          )}
        </div>
      )}

      {mode === "cre" && creExecutionResult && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-xs">
          <div className="text-gray-300">
            Real tx receipt: <span className="text-green-400 font-mono">{creExecutionResult.txHash}</span>
            {creExecutionResult.blockNumber ? ` · block ${creExecutionResult.blockNumber}` : ""}
          </div>
          <a
            href={creExecutionResult.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[#00e0ff] hover:text-[#67e8f9]"
          >
            Open in Tenderly Explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}
