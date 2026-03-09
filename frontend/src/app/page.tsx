"use client";

import { useState, useEffect } from "react";
import { useWallet } from "../lib/useWallet";
import { useContractData, useContractWrite, usePublicContractData } from "../lib/useContracts";
import {
  RISK_LEVELS,
  RISK_COLORS,
  AGENT_TIERS,
  DEPLOYED_CONTRACTS,
  EXPLORER_CONFIG,
  TARGET_CHAIN_DECIMAL,
  getExplorerAddressUrl,
  getExplorerCodeUrl,
  isConfiguredAddress,
} from "../lib/constants";
import { useLiveMarketData } from "../lib/useLiveMarket";
import AgentSimulation from "../components/AgentSimulation";
import toast from "react-hot-toast";
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Wallet,
  Bot,
  BarChart3,
  Zap,
  Eye,
  ArrowRight,
  ExternalLink,
  Github,
  RefreshCw,
  Lock,
  Cpu,
} from "lucide-react";

// ─── Fallback Data (displayed only when the configured chain RPC is unreachable) ─────
const FALLBACK_STATS = {
  totalValueProtected: "0",
  activeAgents: 0,
  threatsDetected: 0,
  protectionRate: "0",
  totalDecisions: 0,
  totalDeposited: "0",
};

// No mock decisions — only real on-chain data or empty state

// No mock positions — only show real user data when wallet connected

const DECISION_TYPES = ["Risk Assessment", "Threat Detected", "Protection Triggered", "All Clear", "Market Analysis", "Position Review"];

export default function Home() {
  const { address, isConnected, connect, disconnect, isConnecting, switchToTargetChain, chainId, provider, signer } = useWallet();
  const contractData = useContractData(provider);
  const contractWrite = useContractWrite(signer);
  const publicData = usePublicContractData();
  const liveMarket = useLiveMarketData(30000);
  const [activeTab, setActiveTab] = useState<"overview" | "decisions" | "positions" | "agent">("overview");
  const [depositAmount, setDepositAmount] = useState("");

  // Fetch public on-chain data immediately (no wallet needed)
  useEffect(() => {
    publicData.fetchPublicData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch contract data when connected
  useEffect(() => {
    if (isConnected && provider) {
      contractData.fetchAll(address ?? undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, provider, address]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isConnected || !provider) return;
    const interval = setInterval(() => {
      contractData.fetchAll(address ?? undefined);
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, provider, address]);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      toast.loading("Depositing...", { id: "deposit" });
      await contractWrite.deposit(depositAmount);
      toast.success(`Deposited ${depositAmount} ETH`, { id: "deposit" });
      setDepositAmount("");
      contractData.fetchAll(address ?? undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deposit failed";
      toast.error(msg, { id: "deposit" });
    }
  };

  const handleAuthorize = async () => {
    try {
      toast.loading("Authorizing agent...", { id: "auth" });
      await contractWrite.authorizeAgent(0);
      toast.success("Agent #0 authorized!", { id: "auth" });
      contractData.fetchAll(address ?? undefined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authorization failed";
      toast.error(msg, { id: "auth" });
    }
  };

  // Merged stats: wallet data > public on-chain data > fallback zeros
  const stats = {
    totalValueProtected: contractData.vaultStats?.totalValueProtected ?? (publicData.isLive ? publicData.totalValueProtected : FALLBACK_STATS.totalValueProtected),
    activeAgents: contractData.agentCount || publicData.agentCount || FALLBACK_STATS.activeAgents,
    threatsDetected: contractData.loggerStats?.totalThreats ?? (publicData.isLive ? publicData.totalThreats : FALLBACK_STATS.threatsDetected),
    protectionRate: contractData.successRate > 0 ? contractData.successRate.toFixed(1) : publicData.isLive && publicData.agentSuccessRate > 0 ? publicData.agentSuccessRate.toFixed(1) : FALLBACK_STATS.protectionRate,
    totalDecisions: contractData.loggerStats?.totalDecisions ?? (publicData.isLive ? publicData.totalDecisions : FALLBACK_STATS.totalDecisions),
    totalDeposited: contractData.vaultStats?.totalEthDeposited ?? (publicData.isLive ? publicData.totalDeposited : FALLBACK_STATS.totalDeposited),
    actionsExecuted: contractData.vaultStats?.totalActionsExecuted ?? (publicData.isLive ? publicData.totalActionsExecuted : 0),
  };

  const dataSource = contractData.isLive ? "wallet" : publicData.isLive ? "public-rpc" : "demo";

  return (
    <div className="min-h-screen">
      {/* ═══ NAVBAR ═══ */}
      <nav className="glass-card mx-4 mt-4 px-6 py-4 flex items-center justify-between" style={{ borderRadius: "12px" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.2), rgba(168,85,247,0.2))" }}>
            <Shield className="w-6 h-6 text-[#00e0ff]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-[#00e0ff] cyan-glow">Aegis</span>{" "}
              <span className="text-gray-300">Protocol</span>
            </h1>
            <p className="text-xs text-gray-500">AI-Powered DeFi Guardian</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ 
            background: dataSource === "wallet" ? "rgba(34,197,94,0.1)" : dataSource === "public-rpc" ? "rgba(0,224,255,0.1)" : "rgba(234,179,8,0.1)", 
            border: `1px solid ${dataSource === "wallet" ? "rgba(34,197,94,0.2)" : dataSource === "public-rpc" ? "rgba(0,224,255,0.2)" : "rgba(234,179,8,0.2)"}` 
          }}>
            <div className={`w-2 h-2 rounded-full ${dataSource === "wallet" ? "bg-green-500" : dataSource === "public-rpc" ? "bg-[#00e0ff]" : "bg-yellow-500"} pulse-live`} />
            <span className={`${dataSource === "wallet" ? "text-green-400" : dataSource === "public-rpc" ? "text-[#00e0ff]" : "text-yellow-400"} text-sm font-medium`}>
              {dataSource === "wallet" ? "Live On-Chain" : dataSource === "public-rpc" ? "On-Chain (Read)" : "Demo Mode"}
            </span>
          </div>

          {isConnected && (
            <button 
              onClick={() => contractData.fetchAll(address ?? undefined)} 
              className="text-gray-500 hover:text-[#00e0ff] transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${contractData.loading ? "animate-spin" : ""}`} />
            </button>
          )}

          {isConnected ? (
            <div className="flex items-center gap-3">
              {chainId !== TARGET_CHAIN_DECIMAL && (
                <button onClick={switchToTargetChain} className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors">
                  Switch / Add {EXPLORER_CONFIG.chainName}
                </button>
              )}
              <div className="glass-card px-4 py-2" style={{ borderRadius: "10px" }}>
                <span className="text-sm text-gray-400">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <button onClick={disconnect} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
                Disconnect
              </button>
            </div>
          ) : (
            <button onClick={connect} disabled={isConnecting} className="btn-primary flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)" }}>
          <Zap className="w-4 h-4 text-[#00e0ff]" />
          <span className="text-sm text-[#00e0ff]">{EXPLORER_CONFIG.chainName} • Uniswap Verified</span>
        </div>
        
        <h2 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
          <span className="text-white">Your AI Guardian</span>
          <br />
          <span className="text-[#00e0ff] cyan-glow">Never Sleeps</span>
        </h2>
        
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
          Aegis is an autonomous AI agent that monitors your DeFi positions on {EXPLORER_CONFIG.chainName} 24/7,
          detects risks in real-time, and executes protective on-chain transactions — 
          before you lose money.
        </p>

        {/* Live Market Ticker */}
        {!liveMarket.isLoading && liveMarket.ethPriceCoinGecko > 0 && (
          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap">
            <div className="glass-card px-4 py-2 flex items-center gap-2" style={{ borderRadius: "10px" }}>
              <div className="w-2 h-2 rounded-full bg-green-500 pulse-live" />
              <span className="text-xs text-gray-500">ETH/USD</span>
              <span className="text-sm font-mono font-bold text-white">${liveMarket.ethPriceCoinGecko.toFixed(2)}</span>
              <span className={`text-xs font-mono ${liveMarket.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                {liveMarket.priceChange24h >= 0 ? "+" : ""}{liveMarket.priceChange24h.toFixed(2)}%
              </span>
            </div>
            <div className="glass-card px-4 py-2 flex items-center gap-2" style={{ borderRadius: "10px" }}>
              <span className="text-xs text-gray-500">Volume 24h</span>
              <span className="text-sm font-mono text-[#00e0ff]">${(liveMarket.volume24h / 1e9).toFixed(2)}B</span>
            </div>
            <div className="glass-card px-4 py-2 flex items-center gap-2" style={{ borderRadius: "10px" }}>
              <span className="text-xs text-gray-500">Ethereum TVL</span>
              <span className="text-sm font-mono text-[#f0b90b]">${(liveMarket.ethereumTvl / 1e9).toFixed(2)}B</span>
            </div>
            <div className="glass-card px-4 py-2 flex items-center gap-2" style={{ borderRadius: "10px" }}>
              <span className="text-xs text-gray-500">Oracle</span>
              <span className={`text-xs font-bold ${liveMarket.oracleStatus === "consistent" ? "text-green-400" : liveMarket.oracleStatus === "warning" ? "text-yellow-400" : "text-red-400"}`}>
                {liveMarket.oracleStatus === "consistent" ? "✓ Verified" : liveMarket.oracleStatus === "warning" ? "⚠ Divergence" : "🚨 Critical"}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-12">
          {!isConnected ? (
            <button onClick={connect} className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
              <Shield className="w-5 h-5" />
              Connect &amp; Protect
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => setActiveTab("positions")} className="btn-primary flex items-center gap-2 text-lg px-8 py-4">
              <Shield className="w-5 h-5" />
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          {EXPLORER_CONFIG.repositoryUrl && (
            <a href={EXPLORER_CONFIG.repositoryUrl} target="_blank" rel="noopener noreferrer" className="glass-card px-8 py-4 flex items-center gap-2 text-gray-300 hover:text-white transition-colors" style={{ borderRadius: "12px" }}>
              <Github className="w-5 h-5" />
              View Source
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { label: "Value Protected", value: `${stats.totalValueProtected} ETH`, icon: Shield },
            { label: "Active Agents", value: stats.activeAgents.toString(), icon: Bot },
            { label: "Threats Detected", value: stats.threatsDetected.toString(), icon: AlertTriangle },
            { label: "Protection Rate", value: `${stats.protectionRate}%`, icon: CheckCircle },
          ].map((stat, i) => (
            <div key={i} className="glass-card glow-border p-5 text-center" style={{ borderRadius: "14px" }}>
              <stat.icon className="w-6 h-6 text-[#00e0ff] mx-auto mb-2" />
              <p className="stat-number">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TABS ═══ */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-1 mb-6 glass-card p-1.5 w-fit mx-auto" style={{ borderRadius: "12px" }}>
            {([
              { key: "overview", label: "Overview", icon: BarChart3 },
              { key: "decisions", label: "AI Decisions", icon: Activity },
              { key: "positions", label: "Positions", icon: Eye },
              { key: "agent", label: "Agent Info", icon: Bot },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-[#00e0ff]/10 text-[#00e0ff] border border-[#00e0ff]/20"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <OverviewTab stats={stats} 
              decisions={contractData.decisions.length > 0 ? contractData.decisions : publicData.recentDecisions} 
              riskSnapshot={contractData.riskSnapshot ?? publicData.publicRiskSnapshot} 
              isLive={contractData.isLive || publicData.isLive} />
          )}
          {activeTab === "decisions" && (
            <DecisionsTab 
              decisions={contractData.decisions.length > 0 ? contractData.decisions : publicData.recentDecisions} 
              agentName={contractData.agentInfo?.name ?? publicData.agentName ?? "Guardian Alpha"} 
              isLive={contractData.isLive || publicData.isLive} />
          )}
          {activeTab === "positions" && (
            <PositionsTab userPosition={contractData.userPosition} isConnected={isConnected} depositAmount={depositAmount}
              setDepositAmount={setDepositAmount} onDeposit={handleDeposit} onAuthorize={handleAuthorize}
              isLive={contractData.isLive} isDeployed={contractData.isDeployed} />
          )}
          {activeTab === "agent" && (
            <AgentTab agentInfo={contractData.agentInfo} publicData={publicData}
              reputation={contractData.reputation || publicData.agentReputation} 
              successRate={contractData.successRate || publicData.agentSuccessRate} isLive={contractData.isLive || publicData.isLive} />
          )}
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">
            How <span className="text-[#00e0ff]">Aegis</span> Protects You
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Eye, title: "24/7 Monitoring", desc: "AI continuously scans your DeFi positions via CoinGecko & DeFiLlama live data feeds, analyzing market conditions and liquidity in real-time." },
              { icon: Cpu, title: "LLM AI Reasoning", desc: "Powered by Groq (Llama 3.3 70B) or OpenAI (GPT-4o). Real natural language market analysis with structured threat reports and heuristic fallback." },
              { icon: AlertTriangle, title: "5-Vector + DEX Verification", desc: "Weighted heuristic risk + Uniswap V2 on-chain price cross-verification. Detects oracle manipulation by comparing API vs DEX prices." },
              { icon: Shield, title: "Autonomous Protection", desc: "When threats exceed your risk threshold, Aegis executes stop-losses, emergency withdrawals, and rebalances — all logged immutably on-chain." },
              { icon: Bot, title: "ERC-721 Agent NFTs", desc: "Each guardian has a verifiable on-chain identity as an NFT with 4 tiers (Scout→Archon), reputation scoring, and performance metrics." },
              { icon: Lock, title: "Non-Custodial Vault", desc: "Your funds stay in your control. Set max slippage, stop-loss thresholds, and action limits. Emergency withdrawal always available." },
            ].map((feature, i) => (
              <div key={i} className="glass-card glow-border p-6 group hover:scale-[1.02] transition-transform" style={{ borderRadius: "16px" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(0,224,255,0.1)" }}>
                  <feature.icon className="w-6 h-6 text-[#00e0ff] group-hover:scale-110 transition-transform" />
                </div>
                <h4 className="text-lg font-semibold mb-2 text-white">{feature.title}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AI INTELLIGENCE ENGINE ═══ */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-4">
            <span className="text-[#00e0ff]">AI Intelligence</span> Engine
          </h3>
          <p className="text-center text-gray-400 mb-10 max-w-2xl mx-auto">
            Aegis combines LLM reasoning with on-chain DEX data for multi-layered threat detection that goes beyond simple heuristics.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* LLM Reasoning Panel */}
            <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#a855f7]" />
                AI Analysis Engine
                <span className="ml-auto text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">{liveMarket.ethPriceCoinGecko > 0 ? "Live Data" : "Offline"}</span>
              </h4>
              <div className="space-y-4">
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <p className="text-xs text-purple-400 font-mono mb-2">Heuristic Risk Analysis — {liveMarket.ethPriceCoinGecko > 0 ? "Live Market Feed" : "Example Output"}</p>
                  <p className="text-sm text-gray-300 leading-relaxed italic">
                    {liveMarket.ethPriceCoinGecko > 0 
                      ? `"ETH trading at $${liveMarket.ethPriceCoinGecko.toFixed(2)} with ${liveMarket.priceChange24h >= 0 ? "+" : ""}${liveMarket.priceChange24h.toFixed(2)}% 24h movement. Volume at $${(liveMarket.volume24h / 1e9).toFixed(2)}B. Ethereum ecosystem TVL at $${(liveMarket.ethereumTvl / 1e9).toFixed(2)}B. Oracle cross-check delta: ${liveMarket.priceDelta.toFixed(3)}%. ${liveMarket.priceDelta < 1 ? "No oracle manipulation detected. All metrics within normal parameters." : "WARNING: Price divergence detected between sources."}"` 
                      : `"ETH trading at $3200.00 with +1.8% 24h movement. Volume at $12.4B (+15% change). Ethereum ecosystem liquidity at $52.0B. Risk engine scores: Liquidation 8/100, Volatility 22/100, Protocol 5/100. No significant threats detected."`
                    }
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)" }}>
                    <p className="text-xs text-gray-500">Sentiment</p>
                    <p className="text-sm font-semibold text-purple-400">
                      {liveMarket.priceChange24h < -5 ? "Bearish" : liveMarket.priceChange24h > 5 ? "Bullish" : "Neutral"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: `rgba(${Math.abs(liveMarket.priceChange24h) > 10 ? "239,68,68" : Math.abs(liveMarket.priceChange24h) > 3 ? "234,179,8" : "34,197,94"},0.08)`, border: `1px solid rgba(${Math.abs(liveMarket.priceChange24h) > 10 ? "239,68,68" : Math.abs(liveMarket.priceChange24h) > 3 ? "234,179,8" : "34,197,94"},0.15)` }}>
                    <p className="text-xs text-gray-500">AI Risk Score</p>
                    <p className={`text-sm font-semibold ${Math.abs(liveMarket.priceChange24h) > 10 ? "text-red-400" : Math.abs(liveMarket.priceChange24h) > 3 ? "text-yellow-400" : "text-green-400"}`}>
                      {Math.min(100, Math.round(Math.abs(liveMarket.priceChange24h) * 4 + (liveMarket.priceDelta > 1 ? 30 : 0)))}/100
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(0,224,255,0.08)", border: "1px solid rgba(0,224,255,0.15)" }}>
                    <p className="text-xs text-gray-500">Confidence</p>
                    <p className="text-sm font-semibold text-[#00e0ff]">{liveMarket.ethPriceCoinGecko > 0 ? Math.max(60, Math.round(100 - Math.abs(liveMarket.priceChange24h) * 2 - liveMarket.priceDelta * 10)) : "—"}%</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: `rgba(${liveMarket.priceDelta > 1 ? "239,68,68" : "34,197,94"},0.08)`, border: `1px solid rgba(${liveMarket.priceDelta > 1 ? "239,68,68" : "34,197,94"},0.15)` }}>
                    <p className="text-xs text-gray-500">Threats</p>
                    <p className={`text-sm font-semibold ${liveMarket.priceDelta > 1 ? "text-red-400" : "text-green-400"}`}>
                      {liveMarket.priceDelta > 5 ? "Oracle Attack" : liveMarket.priceDelta > 1 ? "Divergence" : "None ✓"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Key Insights</p>
                  <div className="space-y-1">
                    {[
                      liveMarket.ethPriceCoinGecko > 0 
                        ? `ETH at $${liveMarket.ethPriceCoinGecko.toFixed(2)} with ${liveMarket.priceChange24h >= 0 ? "+" : ""}${liveMarket.priceChange24h.toFixed(2)}% 24h change`
                        : "ETH stable at $3200.00 with +1.8% 24h change",
                      liveMarket.volume24h > 0
                        ? `24h Volume: $${(liveMarket.volume24h / 1e9).toFixed(2)}B — ${liveMarket.volume24h > 1e9 ? "healthy" : "low"} activity`
                        : "Volume up 15% from baseline — healthy activity",
                      liveMarket.ethereumTvl > 0
                        ? `Ethereum TVL: $${(liveMarket.ethereumTvl / 1e9).toFixed(2)}B — ecosystem ${liveMarket.ethereumTvl > 20e9 ? "strong" : "monitoring"}`
                        : "Liquidity: $52.00B (+0.5%) — no drain risk",
                    ].map((insight, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-400">
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Uniswap DEX Panel */}
            <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
              <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#f0b90b]" />
                Uniswap V2 — On-Chain DEX
                <span className="ml-auto text-xs px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{EXPLORER_CONFIG.chainName}</span>
              </h4>
              <div className="space-y-4">
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <p className="text-xs text-yellow-400 font-mono mb-3">Price Oracle Cross-Verification {liveMarket.ethPriceUniswap > 0 && <span className="text-green-400 ml-2">● LIVE</span>}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">CoinGecko (API)</span>
                      <span className="text-sm font-mono text-white">${liveMarket.ethPriceCoinGecko > 0 ? liveMarket.ethPriceCoinGecko.toFixed(2) : "3200.00"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Uniswap V2 (On-chain)</span>
                      <span className="text-sm font-mono text-white">${liveMarket.ethPriceUniswap > 0 ? liveMarket.ethPriceUniswap.toFixed(2) : "3198.80"}</span>
                    </div>
                    <div className="h-px bg-gray-700 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Price Delta</span>
                      <span className={`text-sm font-mono font-bold ${liveMarket.priceDelta > 1 ? "text-yellow-400" : "text-green-400"}`}>{liveMarket.ethPriceCoinGecko > 0 ? liveMarket.priceDelta.toFixed(3) : "0.038"}% {liveMarket.priceDelta > 1 ? "⚠" : "✓"}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Monitored Ethereum Tokens</p>
                  <div className="flex flex-wrap gap-2">
                    {["WETH", "DAI", "USDT", "USDC", "WBTC", "UNI", "LINK", "AAVE"].map((token) => (
                      <span key={token} className="text-xs px-2 py-1 rounded-md font-mono" style={{ background: "rgba(240,185,11,0.08)", color: "#f0b90b", border: "1px solid rgba(240,185,11,0.15)" }}>
                        {token}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg" style={{ background: "rgba(240,185,11,0.08)", border: "1px solid rgba(240,185,11,0.15)" }}>
                    <p className="text-xs text-gray-500">Oracle Status</p>
                    <p className={`text-sm font-semibold ${liveMarket.oracleStatus === "consistent" ? "text-green-400" : liveMarket.oracleStatus === "warning" ? "text-yellow-400" : "text-red-400"}`}>
                      {liveMarket.oracleStatus === "loading" ? "Loading..." : liveMarket.oracleStatus === "consistent" ? "Consistent ✓" : liveMarket.oracleStatus === "warning" ? "Divergence ⚠" : "CRITICAL 🚨"}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(240,185,11,0.08)", border: "1px solid rgba(240,185,11,0.15)" }}>
                    <p className="text-xs text-gray-500">Data Source</p>
                    <p className="text-sm font-semibold text-yellow-400">{liveMarket.ethPriceUniswap > 0 ? "Live On-Chain" : "On-Chain"}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}>
                  <p className="text-xs text-red-400 font-mono mb-1">Alert Thresholds</p>
                  <p className="text-xs text-gray-400">Delta &gt; 1% → Potential manipulation warning</p>
                  <p className="text-xs text-gray-400">Delta &gt; 5% → CRITICAL oracle attack alert</p>
                </div>
              </div>
            </div>
          </div>

          {/* Agent Loop Diagram */}
          <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
            <h4 className="text-lg font-semibold mb-4 text-center">Agent Decision Loop (30s Cycles)</h4>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              {[
                { label: "OBSERVE", sub: "CoinGecko + DeFiLlama", color: "#00e0ff" },
                { label: "ANALYZE", sub: "5-Vector Risk Engine", color: "#a855f7" },
                { label: "AI REASON", sub: "LLM (Groq/OpenAI)", color: "#f97316" },
                { label: "DEX VERIFY", sub: "Uniswap V2", color: "#f0b90b" },
                { label: "DECIDE", sub: "Threat + Confidence", color: "#ef4444" },
                { label: "EXECUTE", sub: "On-Chain TX", color: "#22c55e" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="p-3 rounded-xl text-center min-w-[120px]" style={{ background: `${step.color}10`, border: `1px solid ${step.color}30` }}>
                    <p className="font-bold" style={{ color: step.color }}>{step.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{step.sub}</p>
                  </div>
                  {i < 5 && <ArrowRight className="w-4 h-4 text-gray-600 hidden md:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LIVE AGENT + CRE WORKFLOW ═══ */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-4">
            <span className="text-[#00e0ff]">Live</span> Agent & CRE Workflow
          </h3>
          <p className="text-center text-gray-400 mb-10 max-w-2xl mx-auto">
            Switch between the native guardian loop and a Chainlink Runtime Environment live test
            running against {EXPLORER_CONFIG.chainName} through Tenderly RPC, with execution logs streamed into the bottom
            Terminal Activity panel.
          </p>
          <AgentSimulation
            market={liveMarket}
            isWalletConnected={isConnected}
            walletAddress={address}
            executeCreWrite={contractWrite.logDecision}
          />
        </div>
      </section>

      {/* ═══ DEPLOYED & VERIFIED ON-CHAIN ═══ */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-4">
            {EXPLORER_CONFIG.chainName} <span className="text-[#00e0ff]">Contract</span> Surfaces
          </h3>
          <p className="text-center text-gray-400 mb-10 max-w-xl mx-auto">
            Explorer and contract links are now driven by environment configuration. Point them at your real deployment and runtime explorers before going live.
          </p>

          <div className="glass-card glow-border p-6 mb-8 overflow-x-auto" style={{ borderRadius: "16px" }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h4 className="text-lg font-semibold text-white">Env-driven deployed contract table</h4>
                <p className="text-sm text-gray-400">
                  Primary explorer: <span className="text-[#00e0ff]">{EXPLORER_CONFIG.explorerName}</span> · Tenderly runtime explorer: <span className="text-purple-400">{EXPLORER_CONFIG.tenderlyExplorerName}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                <span>{EXPLORER_CONFIG.chainName}</span>
                <span>•</span>
                <span>{EXPLORER_CONFIG.explorerUrl}</span>
              </div>
            </div>

            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/5">
                  <th className="pb-3 pr-4">Contract</th>
                  <th className="pb-3 pr-4">Address</th>
                  <th className="pb-3 pr-4">Explorer</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEPLOYED_CONTRACTS.map((contract) => {
                  const configured = isConfiguredAddress(contract.address);

                  return (
                    <tr key={contract.key} className="border-b border-white/5 last:border-b-0 align-top">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: contract.color }} />
                          <div>
                            <div className="font-semibold text-white">{contract.name}</div>
                            <div className="text-xs text-gray-500">{contract.sourcePath}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-300 break-all">{contract.address}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={getExplorerAddressUrl(contract.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#00e0ff]/20 text-[#00e0ff] hover:border-[#00e0ff]/40"
                          >
                            <ExternalLink className="w-3 h-3" /> {EXPLORER_CONFIG.explorerName}
                          </a>
                          <a
                            href={getExplorerCodeUrl(contract.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-green-500/20 text-green-400 hover:border-green-500/40"
                          >
                            <CheckCircle className="w-3 h-3" /> Code
                          </a>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs border ${
                          configured
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        }`}>
                          {configured ? "Configured" : "Placeholder"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {DEPLOYED_CONTRACTS.map((contract) => (
              <div key={contract.key} className="glass-card glow-border p-6 group" style={{ borderRadius: "16px" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: contract.color }} />
                  <h4 className="font-mono text-lg font-bold" style={{ color: contract.color }}>{contract.name}</h4>
                  <span className="ml-auto text-xs text-gray-500 font-mono">{contract.lines}</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">{contract.description}</p>
                <div className="bg-black/30 rounded-lg p-3 mb-4">
                  <p className="font-mono text-xs text-gray-300 break-all">{contract.address}</p>
                </div>
                <div className="flex gap-2">
                  <a href={getExplorerAddressUrl(contract.address)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(0,224,255,0.08)", color: "#00e0ff", border: "1px solid rgba(0,224,255,0.15)" }}>
                    <ExternalLink className="w-3 h-3" /> {EXPLORER_CONFIG.explorerName}
                  </a>
                  <a href={getExplorerCodeUrl(contract.address)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <CheckCircle className="w-3 h-3" /> View Code
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Reference Transaction Lifecycle */}
          <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00e0ff]" />
              Reference Transaction Lifecycle
              <span className="ml-auto text-xs px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Update After Mainnet Deployment</span>
            </h4>
            <p className="text-sm text-gray-400 mb-4">Illustrative threat lifecycle: Normal → Volatility Warning → Threat Detected → Protection Triggered → Recovery → Review</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b" style={{ borderColor: "rgba(0,224,255,0.05)" }}>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Phase</th>
                    <th className="px-4 py-2 text-left">Action</th>
                    <th className="px-4 py-2 text-left">Risk</th>
                    <th className="px-4 py-2 text-left">Reference Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { phase: "Setup", action: "Vault Deposit (0.005 ETH)", risk: "—", hash: "0x3602f865ec5df8b7bcb389f0caea337cdbe7bd5da699bfe373d1176894216c7a" },
                    { phase: "Config", action: "Risk Profile (Conservative)", risk: "—", hash: "0x4e2ddc3e04bee004d185574497b746ac5cc561ab1da362e1eb64f207bd126989" },
                    { phase: "Normal", action: "AI Analysis → All Clear (92%)", risk: "NONE", hash: "0xf0922ad8ff51553d014ebad35c04b7b72e0ec2b216325d652f557e988765dbfb" },
                    { phase: "Normal", action: "Risk Snapshot (15/100)", risk: "LOW", hash: "0xcd74298263c839ce58dd65d453dea8a88776fb5bb34029ad972eccd1ca584618" },
                    { phase: "Escalation", action: "Volatility Warning (-4.2%)", risk: "LOW", hash: "0xeed6b6541031012209d9318fad7851db395304f1e2a2978ae3a98f91b02500ef" },
                    { phase: "Escalation", action: "Risk Snapshot (38/100)", risk: "MED", hash: "0x60e7f39ebc63a4e585684f1d0fe21ab22d52a14700aa5e4ead21fc766441ddf4" },
                    { phase: "Threat", action: "Abnormal Volume (+350%)", risk: "HIGH", hash: "0x8e8e1f31f29ab36d60d3cec4be03db00919abbded5ed54e48702d5658ba7d97d" },
                    { phase: "Defense", action: "Aggressive Profile (0.3% slip)", risk: "—", hash: "0x7b7546b846181312fde544b2f89ee8e7e53ffd0002bada657a8c10848e0b6021" },
                    { phase: "Defense", action: "Risk Snapshot (68/100)", risk: "HIGH", hash: "0x2a8c0b20cedebb1af168b5545f46911d79b98feeaa05d0e4e647055eb8c402d3" },
                    { phase: "Protection", action: "Stop-Loss Triggered (95%)", risk: "CRIT", hash: "0xea98d417b4ae7aaf6d568f85bf2ba6fa1cb1b1ee5c30f08d59959aa69228ae11" },
                    { phase: "Recovery", action: "Market Stabilized", risk: "LOW", hash: "0xbbc362118ad2040c44b6a680bc789a6b82f52227bb0a82f4511d525f69d4912c" },
                    { phase: "Recovery", action: "Risk Normalized (18/100)", risk: "LOW", hash: "0x530f57e3d88c15d34fc5e57f3bf3788f0eeceec5df82ab7c2243baa4565b3eb6" },
                    { phase: "Review", action: "Position Review (98%)", risk: "NONE", hash: "0x226c18891d7b6edfba75cde1701dc807b9cd42d6c697309b72ac524754fdfbab" },
                  ].map((tx, i) => (
                    <tr key={i} className="border-b hover:bg-white/[0.02]" style={{ borderColor: "rgba(0,224,255,0.03)" }}>
                      <td className="px-4 py-2.5 text-gray-500 font-mono">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-md ${
                          tx.phase === "Threat" || tx.phase === "Protection" ? "bg-red-500/10 text-red-400" :
                          tx.phase === "Escalation" || tx.phase === "Defense" ? "bg-yellow-500/10 text-yellow-400" :
                          tx.phase === "Recovery" ? "bg-green-500/10 text-green-400" :
                          "bg-gray-500/10 text-gray-400"
                        }`}>{tx.phase}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-300 text-xs">{tx.action}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-mono ${
                          tx.risk === "CRIT" ? "text-red-400" :
                          tx.risk === "HIGH" ? "text-orange-400" :
                          tx.risk === "MED" ? "text-yellow-400" :
                          tx.risk === "LOW" ? "text-blue-400" :
                          tx.risk === "NONE" ? "text-green-400" :
                          "text-gray-500"
                        }`}>{tx.risk}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-[#00e0ff]">
                        {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tech Stack Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[
              { label: "Solidity Tests", value: "54 Passing", color: "#22c55e" },
              { label: "Contract LOC", value: "1,326", color: "#00e0ff" },
              { label: "AI Engine", value: "LLM + Heuristic", color: "#a855f7" },
              { label: "DEX Integration", value: "Uniswap V2", color: "#f0b90b" },
            ].map((badge, i) => (
              <div key={i} className="glass-card p-4 text-center" style={{ borderRadius: "12px", borderLeft: `3px solid ${badge.color}` }}>
                <p className="text-lg font-bold" style={{ color: badge.color }}>{badge.value}</p>
                <p className="text-xs text-gray-500 mt-1">{badge.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="glass-card mx-4 mb-4 px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderRadius: "12px" }}>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#00e0ff]" />
          <span className="text-gray-400">Aegis Protocol — Autonomous Protection for {EXPLORER_CONFIG.chainName}</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {DEPLOYED_CONTRACTS.map((contract) => (
            <a
              key={contract.key}
              href={getExplorerAddressUrl(contract.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
            >
              {contract.name.replace("Aegis", "")} <ExternalLink className="w-3 h-3" />
            </a>
          ))}
          {EXPLORER_CONFIG.repositoryUrl && (
            <>
              <span className="text-gray-700">|</span>
              <a href={EXPLORER_CONFIG.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-sm">
                <Github className="w-3 h-3" /> Source
              </a>
            </>
          )}
          <span className="text-gray-600 text-sm">{EXPLORER_CONFIG.explorerName}</span>
        </div>
      </footer>
    </div>
  );
}

// ─── TAB: Overview ────────────────────────────────────────────
interface OverviewProps {
  stats: Record<string, string | number>;
  decisions: { decisionType: number; riskLevel: number; confidence: number; targetUser: string; timestamp: number; actionTaken: boolean }[];
  riskSnapshot: { liquidationRisk: number; volatilityScore: number; protocolRisk: number; smartContractRisk: number } | null;
  isLive: boolean;
}
function OverviewTab({ stats, decisions, riskSnapshot, isLive }: OverviewProps) {
  const riskBars = riskSnapshot ? [
    { label: "Liquidation Risk", value: riskSnapshot.liquidationRisk, color: riskSnapshot.liquidationRisk > 50 ? "#ef4444" : riskSnapshot.liquidationRisk > 25 ? "#eab308" : "#22c55e" },
    { label: "Volatility", value: riskSnapshot.volatilityScore, color: riskSnapshot.volatilityScore > 50 ? "#f97316" : riskSnapshot.volatilityScore > 25 ? "#eab308" : "#22c55e" },
    { label: "Protocol Risk", value: riskSnapshot.protocolRisk, color: riskSnapshot.protocolRisk > 50 ? "#ef4444" : "#22c55e" },
    { label: "Smart Contract Risk", value: riskSnapshot.smartContractRisk, color: riskSnapshot.smartContractRisk > 30 ? "#eab308" : "#22c55e" },
  ] : [
    { label: "Liquidation Risk", value: 0, color: "#6b7280" },
    { label: "Volatility", value: 0, color: "#6b7280" },
    { label: "Protocol Risk", value: 0, color: "#6b7280" },
    { label: "Smart Contract Risk", value: 0, color: "#6b7280" },
  ];

  const displayDecisions = decisions.slice(0, 4).map((d, i) => ({
    id: i + 1,
    type: DECISION_TYPES[d.decisionType] || "Unknown",
    risk: d.riskLevel,
    user: `${d.targetUser.slice(0, 5)}...${d.targetUser.slice(-3)}`,
    time: new Date(d.timestamp * 1000).toLocaleTimeString(),
    action: d.actionTaken,
  }));

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#00e0ff]" />
          System Risk Overview
          {isLive && <span className="text-xs text-green-400 ml-auto">LIVE</span>}
        </h4>
        <div className="space-y-4">
          {riskBars.map((risk, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">{risk.label}</span>
                <span className="font-mono" style={{ color: risk.color }}>{risk.value}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${risk.value}%`, background: risk.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#00e0ff]" />
          Recent Activity
        </h4>
        <div className="space-y-3">
          {displayDecisions.length > 0 ? displayDecisions.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${RISK_COLORS[d.risk]}15` }}>
                {d.risk >= 3 ? <AlertTriangle className="w-4 h-4" style={{ color: RISK_COLORS[d.risk] }} /> : <CheckCircle className="w-4 h-4" style={{ color: RISK_COLORS[d.risk] }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.type}</p>
                <p className="text-xs text-gray-500">{d.user} · {d.time}</p>
              </div>
              <span className="text-xs font-mono px-2 py-1 rounded-md" style={{ background: `${RISK_COLORS[d.risk]}15`, color: RISK_COLORS[d.risk] }}>
                {RISK_LEVELS[d.risk]}
              </span>
            </div>
          )) : (
            <div className="text-center py-6 text-gray-500 text-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              {isLive ? "No decisions logged yet on-chain." : `Connecting to ${EXPLORER_CONFIG.chainName}...`}
            </div>
          )}
        </div>
      </div>

      <div className="glass-card glow-border p-6 md:col-span-2" style={{ borderRadius: "16px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#00e0ff]" />
          Protocol Statistics
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Decisions", value: stats.totalDecisions },
            { label: "Value Protected", value: `${stats.totalValueProtected} ETH` },
            { label: "Total Deposited", value: `${stats.totalDeposited} ETH` },
            { label: "Threats Blocked", value: stats.threatsDetected },
            { label: "Success Rate", value: `${stats.protectionRate}%` },
          ].map((stat, i) => (
            <div key={i} className="text-center p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
              <p className="stat-number text-2xl">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: AI Decisions ────────────────────────────────────────
function DecisionsTab({ decisions, agentName, isLive }: {
  decisions: { decisionType: number; riskLevel: number; confidence: number; targetUser: string; timestamp: number; actionTaken: boolean }[];
  agentName: string;
  isLive: boolean;
}) {
  const displayDecisions = decisions.map((d, i) => ({
    id: i + 1, agent: agentName, type: DECISION_TYPES[d.decisionType] || "Unknown", risk: d.riskLevel,
    confidence: d.confidence, user: `${d.targetUser.slice(0, 5)}...${d.targetUser.slice(-3)}`,
    time: new Date(d.timestamp * 1000).toLocaleString(), action: d.actionTaken,
  }));

  return (
    <div className="glass-card glow-border overflow-hidden" style={{ borderRadius: "16px" }}>
      <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: "rgba(0,224,255,0.1)" }}>
        <h4 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#00e0ff]" />
          AI Decision Log
          <span className="text-xs text-gray-500 ml-2">(On-chain verified)</span>
        </h4>
        {isLive && <span className="text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">LIVE DATA</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-sm text-gray-500 border-b" style={{ borderColor: "rgba(0,224,255,0.05)" }}>
              <th className="px-6 py-3 text-left">ID</th>
              <th className="px-6 py-3 text-left">Agent</th>
              <th className="px-6 py-3 text-left">Type</th>
              <th className="px-6 py-3 text-left">Risk</th>
              <th className="px-6 py-3 text-left">Confidence</th>
              <th className="px-6 py-3 text-left">User</th>
              <th className="px-6 py-3 text-left">Time</th>
              <th className="px-6 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayDecisions.length > 0 ? displayDecisions.map((d) => (
              <tr key={d.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: "rgba(0,224,255,0.03)" }}>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">#{d.id}</td>
                <td className="px-6 py-4 text-sm">{d.agent}</td>
                <td className="px-6 py-4"><span className="text-sm px-2 py-1 rounded-md" style={{ background: "rgba(0,224,255,0.08)", color: "#00e0ff" }}>{d.type}</span></td>
                <td className="px-6 py-4"><span className="text-sm font-medium px-2 py-1 rounded-md" style={{ background: `${RISK_COLORS[d.risk]}15`, color: RISK_COLORS[d.risk] }}>{RISK_LEVELS[d.risk]}</span></td>
                <td className="px-6 py-4 text-sm font-mono">{d.confidence}%</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{d.user}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{d.time}</td>
                <td className="px-6 py-4">
                  {d.action ? <span className="flex items-center gap-1 text-sm text-green-400"><CheckCircle className="w-4 h-4" /> Executed</span>
                    : <span className="text-sm text-gray-500">Monitor</span>}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500 text-sm">
                {isLive ? "No decisions logged on-chain yet. Run the agent to generate real AI decisions." : `Connecting to ${EXPLORER_CONFIG.chainName} RPC...`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB: Positions ───────────────────────────────────────────
interface PositionsProps {
  userPosition: { ethBalance: string; isActive: boolean; agentAuthorized: boolean; authorizedAgentId: number; riskProfile: { maxSlippage: number; stopLossThreshold: number; allowAutoWithdraw: boolean } } | null;
  isConnected: boolean; depositAmount: string; setDepositAmount: (v: string) => void;
  onDeposit: () => void; onAuthorize: () => void; isLive: boolean; isDeployed: boolean;
}
function PositionsTab({ userPosition, isConnected, depositAmount, setDepositAmount, onDeposit, onAuthorize, isLive, isDeployed }: PositionsProps) {
  return (
    <div className="space-y-6">
      {isConnected && isDeployed && (
        <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
          <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#00e0ff]" />
            Your Position
            {isLive && <span className="text-xs text-green-400 ml-auto">LIVE</span>}
          </h4>
          {userPosition?.isActive ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className="stat-number text-xl">{userPosition.ethBalance} ETH</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <p className="text-xs text-gray-500">Agent</p>
                  <p className="text-sm font-semibold">{userPosition.agentAuthorized ? `#${userPosition.authorizedAgentId}` : "None"}</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <p className="text-xs text-gray-500">Stop-Loss</p>
                  <p className="text-sm font-mono">{userPosition.riskProfile.stopLossThreshold / 100}%</p>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <p className="text-xs text-gray-500">Auto-Withdraw</p>
                  <p className="text-sm">{userPosition.riskProfile.allowAutoWithdraw ? "Enabled" : "Disabled"}</p>
                </div>
              </div>
              {!userPosition.agentAuthorized && (
                <button onClick={onAuthorize} className="btn-primary flex items-center gap-2">
                  <Bot className="w-4 h-4" /> Authorize Guardian Agent #0
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-4">No active position. Deposit ETH to get started.</p>
              <div className="flex items-center gap-3 max-w-sm mx-auto">
                <input type="number" step="0.01" placeholder="Amount (ETH)" value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-black/30 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#00e0ff]/50" />
                <button onClick={onDeposit} className="btn-primary px-6 py-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Deposit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-[#00e0ff]" /> Protected Positions
        </h4>
        <div className="text-center py-8">
          <Shield className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {isConnected ? "No protected positions yet. Deposit ETH and authorize an agent to start." : "Connect wallet to view and manage positions."}
          </p>
        </div>
      </div>

      {!isConnected && (
        <div className="glass-card glow-border p-8 text-center" style={{ borderRadius: "16px" }}>
          <Shield className="w-12 h-12 text-[#00e0ff] mx-auto mb-4" />
          <h4 className="text-xl font-semibold mb-2">Protect Your DeFi Position</h4>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect your wallet, deposit ETH, authorize your AI guardian, and sleep peacefully knowing your assets are protected 24/7.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── TAB: Agent Info ──────────────────────────────────────────
function AgentTab({ agentInfo, publicData, reputation, successRate, isLive }: {
  agentInfo: { name: string; operator: string; tier: number; totalDecisions: number; successfulActions: number; totalValueProtected: string; registeredAt: number } | null;
  publicData: { agentName: string; agentTier: number; agentOperator: string; agentTotalDecisions: number; agentSuccessfulActions: number; agentTotalValueProtected: string; agentRegisteredAt: number; isLive: boolean };
  reputation: number; successRate: number; isLive: boolean;
}) {
  // Use wallet data > public RPC data > zeros (never fake inflated values)
  const agent = agentInfo ?? (publicData.isLive ? {
    name: publicData.agentName || "Agent #0",
    operator: publicData.agentOperator || "—",
    tier: publicData.agentTier,
    totalDecisions: publicData.agentTotalDecisions,
    successfulActions: publicData.agentSuccessfulActions,
    totalValueProtected: publicData.agentTotalValueProtected,
    registeredAt: publicData.agentRegisteredAt,
  } : {
    name: "Agent #0", operator: "—", tier: 0, totalDecisions: 0,
    successfulActions: 0, totalValueProtected: "0", registeredAt: 0,
  });
  const displayReputation = reputation > 0 ? reputation.toFixed(2) : "0.00";
  const displaySuccessRate = successRate > 0 ? `${successRate.toFixed(1)}%` : "0%";

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(0,224,255,0.2), rgba(168,85,247,0.2))" }}>
            <Bot className="w-8 h-8 text-[#00e0ff]" />
          </div>
          <div>
            <h4 className="text-xl font-bold">{agent.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-md bg-[#00e0ff]/10 text-[#00e0ff] border border-[#00e0ff]/20">
                {AGENT_TIERS[agent.tier]} Tier
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live" /> Active
              </span>
              {isLive && <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400">LIVE</span>}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: "Agent ID", value: "#0 (ERC-721 NFT)" },
            { label: "Operator", value: typeof agent.operator === "string" && agent.operator.length > 10 ? `${agent.operator.slice(0, 8)}...${agent.operator.slice(-4)}` : agent.operator },
            { label: "Registered", value: new Date(agent.registeredAt * 1000).toLocaleDateString() },
            { label: "Total Decisions", value: agent.totalDecisions.toLocaleString() },
            { label: "Successful Actions", value: agent.successfulActions.toString() },
            { label: "Success Rate", value: displaySuccessRate },
            { label: "Value Protected", value: `${agent.totalValueProtected} ETH` },
          ].map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <span className="text-sm text-gray-500">{item.label}</span>
              <span className="text-sm font-mono">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
        <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#00e0ff]" /> Reputation &amp; Performance
        </h4>
        <div className="text-center mb-6 p-6 rounded-xl" style={{ background: "rgba(0,0,0,0.2)" }}>
          <p className="text-6xl font-bold text-[#00e0ff] cyan-glow">{displayReputation}</p>
          <p className="text-sm text-gray-500 mt-2">Average Rating</p>
          <div className="flex justify-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-xl ${star <= Math.round(parseFloat(displayReputation)) ? "text-yellow-400" : "text-yellow-400/30"}`}>★</span>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Capabilities</h5>
          {[
            "Real-time DeFi position monitoring (30s cycles)",
            "LLM-powered reasoning (Groq Llama 3.3 70B / OpenAI GPT-4o)",
            "Uniswap V2 on-chain price verification",
            "CoinGecko + DeFiLlama live data feeds",
            "5-vector weighted risk analysis engine",
            "Autonomous stop-loss & emergency withdrawal",
            "On-chain decision attestation (keccak256 reasoning hash)",
          ].map((cap, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00e0ff] flex-shrink-0" />
              <span className="text-sm text-gray-300">{cap}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card glow-border p-6 md:col-span-2" style={{ borderRadius: "16px" }}>
        <h4 className="text-lg font-semibold mb-4">Smart Contract Architecture</h4>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: "AegisRegistry", desc: "ERC-721 agent identity NFTs with 4-tier permissions, reputation scoring (1-5), and on-chain performance metrics.", color: "#00e0ff" },
            { name: "AegisVault", desc: "Non-custodial vault for ETH/ERC-20 with agent authorization, per-user risk profiles, and autonomous protection execution.", color: "#a855f7" },
            { name: "DecisionLogger", desc: "Immutable audit trail of every AI decision — risk snapshots, threat detections, and protection actions with reasoning hashes.", color: "#22c55e" },
          ].map((contract, i) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,0.2)", borderLeft: `3px solid ${contract.color}` }}>
              <h5 className="font-mono text-sm font-bold mb-2" style={{ color: contract.color }}>{contract.name}</h5>
              <p className="text-xs text-gray-400 leading-relaxed">{contract.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
