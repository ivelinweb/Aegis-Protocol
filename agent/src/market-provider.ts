// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Live Market Data Provider
// Fetches REAL market data from CoinGecko, DeFiLlama, and Ethereum
// ═══════════════════════════════════════════════════════════════

import { MarketData } from "./analyzer";

interface CoinGeckoResponse {
  ethereum: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
  };
}

interface DeFiLlamaProtocol {
  tvl: number;
  change_1d: number;
}

/**
 * Fetches real ETH market data from public APIs (no API key needed)
 * Uses CoinGecko for price/volume and DeFiLlama for TVL/liquidity
 */
export class LiveMarketProvider {
  private lastData: MarketData | null = null;
  private lastFetchTime = 0;
  private cacheDurationMs = 15000; // 15s cache to avoid rate limits

  /**
   * Get real ETH market data from live APIs
   */
  async fetchLiveData(): Promise<MarketData> {
    // Use cached data if fresh enough
    if (this.lastData && Date.now() - this.lastFetchTime < this.cacheDurationMs) {
      return this.lastData;
    }

    const [priceData, tvlData] = await Promise.allSettled([
      this.fetchCoinGeckoData(),
      this.fetchDeFiLlamaData(),
    ]);

    const price = priceData.status === "fulfilled" ? priceData.value : null;
    const tvl = tvlData.status === "fulfilled" ? tvlData.value : null;

    const data: MarketData = {
      price: price?.price ?? 3200,
      priceChange24h: price?.priceChange24h ?? 0,
      volume24h: price?.volume24h ?? 12_000_000_000,
      volumeChange: this.calculateVolumeChange(price?.volume24h),
      liquidity: tvl?.tvl ?? 50_000_000_000,
      liquidityChange: tvl?.change1d ?? 0,
      holders: 300_000_000, // Approximate ETH address count / holder footprint
      topHolderPercent: 10.5, // Large custodial/staking concentration estimate
    };

    this.lastData = data;
    this.lastFetchTime = Date.now();

    console.log(`[LiveMarket] Fetched: ETH=$${data.price.toFixed(2)}, 24h=${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h.toFixed(2)}%, vol=$${(data.volume24h / 1e6).toFixed(0)}M`);
    return data;
  }

  /**
   * CoinGecko free API — ETH price, 24h change, volume
   */
  private async fetchCoinGeckoData(): Promise<{
    price: number;
    priceChange24h: number;
    volume24h: number;
  }> {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true";
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      
      const json = (await res.json()) as CoinGeckoResponse;
      const eth = json.ethereum;

      return {
        price: eth.usd,
        priceChange24h: eth.usd_24h_change,
        volume24h: eth.usd_24h_vol,
      };
    } catch (err: any) {
      console.warn(`[LiveMarket] CoinGecko failed: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * DeFiLlama free API — Ethereum TVL (proxy for liquidity depth)
   */
  private async fetchDeFiLlamaData(): Promise<{
    tvl: number;
    change1d: number;
  }> {
    const url = "https://api.llama.fi/v2/chains";
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);

      const chains = (await res.json()) as any[];
      const ethereum = chains.find((c: any) => c.gecko_id === "ethereum" || c.name === "Ethereum");

      if (!ethereum) throw new Error("Ethereum chain data not found");

      return {
        tvl: ethereum.tvl ?? 50_000_000_000,
        change1d: ethereum.change_1d ?? 0,
      };
    } catch (err: any) {
      console.warn(`[LiveMarket] DeFiLlama failed: ${err.message}`);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calculate volume change relative to typical ETH daily volume
   */
  private calculateVolumeChange(currentVolume?: number): number {
    if (!currentVolume) return 0;
    // ETH typical daily volume is often in the ~$10B+ range
    const typicalVolume = 12_000_000_000;
    return ((currentVolume - typicalVolume) / typicalVolume) * 100;
  }
}

/**
 * Ethereum on-chain data provider using public RPC
 * Fetches gas prices, block times, and pending tx data
 */
export class EthereumOnChainProvider {
  private rpcUrl: string;

  constructor(rpcUrl: string = "https://ethereum-rpc.publicnode.com") {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Get current Ethereum gas price (indicator of network congestion)
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_gasPrice",
          params: [],
          id: 1,
        }),
      });
      const json = await res.json() as any;
      return BigInt(json.result);
    } catch {
      return 5000000000n; // 5 gwei default
    }
  }

  /**
   * Get latest block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1,
        }),
      });
      const json = await res.json() as any;
      return parseInt(json.result, 16);
    } catch {
      return 0;
    }
  }
}
