// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Live Market Data Hook
// Fetches real-time ETH price from CoinGecko + Uniswap V2
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { PRIMARY_RPC_URL } from "./constants";

// Uniswap V2 Router on Ethereum state mirrored by the Tenderly virtual network
const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH = "0xC02aaA39B223FE8D0A0E5C4F27eAD9083C756Cc2";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
];

export interface LiveMarketData {
  ethPriceCoinGecko: number;
  ethPriceUniswap: number;
  priceDelta: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  ethereumTvl: number;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
  oracleStatus: "consistent" | "warning" | "critical" | "loading";
}

const INITIAL_STATE: LiveMarketData = {
  ethPriceCoinGecko: 0,
  ethPriceUniswap: 0,
  priceDelta: 0,
  priceChange24h: 0,
  volume24h: 0,
  marketCap: 0,
  ethereumTvl: 0,
  lastUpdated: 0,
  isLoading: true,
  error: null,
  oracleStatus: "loading",
};

export function useLiveMarketData(refreshInterval = 30000) {
  const [data, setData] = useState<LiveMarketData>(INITIAL_STATE);

  const fetchData = useCallback(async () => {
    try {
      // Fetch CoinGecko + DeFiLlama in parallel
      const [cgRes, llamaRes] = await Promise.allSettled([
        fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true"
        ).then((r) => r.json()),
        fetch("https://api.llama.fi/v2/chains").then((r) => r.json()),
      ]);

      let cgPrice = 0;
      let change24h = 0;
      let volume = 0;
      let marketCap = 0;

      if (cgRes.status === "fulfilled" && cgRes.value?.ethereum) {
        const eth = cgRes.value.ethereum;
        cgPrice = eth.usd || 0;
        change24h = eth.usd_24h_change || 0;
        volume = eth.usd_24h_vol || 0;
        marketCap = eth.usd_market_cap || 0;
      }

      let ethereumTvl = 0;
      if (llamaRes.status === "fulfilled" && Array.isArray(llamaRes.value)) {
        const ethereum = llamaRes.value.find(
          (c: { name?: string; gecko_id?: string }) => c.name === "Ethereum" || c.gecko_id === "ethereum"
        );
        if (ethereum) ethereumTvl = ethereum.tvl || 0;
      }

      // Fetch Uniswap V2 on-chain price
      let dexPrice = 0;
      try {
        const ethProvider = new ethers.JsonRpcProvider(PRIMARY_RPC_URL);
        const router = new ethers.Contract(
          UNISWAP_V2_ROUTER,
          ROUTER_ABI,
          ethProvider
        );
        const amountIn = ethers.parseEther("1");
        const amounts = await router.getAmountsOut(amountIn, [WETH, DAI]);
        dexPrice = parseFloat(ethers.formatEther(amounts[1]));
      } catch {
        // Uniswap price unavailable — use CoinGecko only
        dexPrice = cgPrice;
      }

      // Calculate delta
      const delta =
        cgPrice > 0 && dexPrice > 0
          ? Math.abs(((cgPrice - dexPrice) / dexPrice) * 100)
          : 0;

      const oracleStatus: LiveMarketData["oracleStatus"] =
        delta > 5 ? "critical" : delta > 1 ? "warning" : "consistent";

      setData({
        ethPriceCoinGecko: cgPrice,
        ethPriceUniswap: dexPrice,
        priceDelta: delta,
        priceChange24h: change24h,
        volume24h: volume,
        marketCap: marketCap,
        ethereumTvl,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
        oracleStatus,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return data;
}
