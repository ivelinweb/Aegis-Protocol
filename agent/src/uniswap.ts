// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Uniswap V2 Integration
// Real on-chain DEX price feeds and token analysis for Ethereum
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

// Uniswap V2 Router and Factory on Ethereum Mainnet
const UNISWAP_ROUTER_MAINNET = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAP_FACTORY_MAINNET = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

// Common Ethereum token addresses
export const ETHEREUM_TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDAE9",
};

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function factory() external view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  "function allPairsLength() external view returns (uint)",
];

const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function totalSupply() external view returns (uint256)",
];

const ERC20_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address) external view returns (uint256)",
];

export interface PairData {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  priceToken0InToken1: number;
  priceToken1InToken0: number;
  liquidityUSD: number;
}

export interface TokenPrice {
  symbol: string;
  address: string;
  priceUSD: number;
  liquidityUSD: number;
  pairAddress: string;
}

// ─── Uniswap Provider ─────────────────────────────────────────

export class UniswapProvider {
  private provider: ethers.JsonRpcProvider;
  private router: ethers.Contract;
  private factory: ethers.Contract;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private cacheTTL = 30000; // 30s cache

  constructor(rpcUrl: string = "https://ethereum-rpc.publicnode.com") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.router = new ethers.Contract(UNISWAP_ROUTER_MAINNET, ROUTER_ABI, this.provider);
    this.factory = new ethers.Contract(UNISWAP_FACTORY_MAINNET, FACTORY_ABI, this.provider);
    console.log("[Uniswap] DEX provider initialized (Ethereum Mainnet)");
  }

  /**
   * Get token price in USD via Uniswap V2 Router
   * Routes: TOKEN → WETH → DAI
   */
  async getTokenPriceUSD(tokenAddress: string): Promise<number> {
    // Check cache
    const cached = this.priceCache.get(tokenAddress.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.price;
    }

    try {
      const amountIn = ethers.parseEther("1");

      if (tokenAddress.toLowerCase() === ETHEREUM_TOKENS.WETH.toLowerCase()) {
        // ETH → DAI direct
        const amounts = await this.router.getAmountsOut(amountIn, [
          ETHEREUM_TOKENS.WETH,
          ETHEREUM_TOKENS.DAI,
        ]);
        const price = parseFloat(ethers.formatEther(amounts[1]));
        this.priceCache.set(tokenAddress.toLowerCase(), { price, timestamp: Date.now() });
        return price;
      }

      // TOKEN → WETH → DAI
      const amounts = await this.router.getAmountsOut(amountIn, [
        tokenAddress,
        ETHEREUM_TOKENS.WETH,
        ETHEREUM_TOKENS.DAI,
      ]);
      const price = parseFloat(ethers.formatEther(amounts[2]));
      this.priceCache.set(tokenAddress.toLowerCase(), { price, timestamp: Date.now() });
      return price;
    } catch (error: any) {
      console.warn(`[Uniswap] Price fetch failed for ${tokenAddress}: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get ETH price in USD (most common query)
   */
  async getETHPrice(): Promise<number> {
    return this.getTokenPriceUSD(ETHEREUM_TOKENS.WETH);
  }

  /**
   * Get pair reserves and liquidity data
   */
  async getPairData(token0Address: string, token1Address: string): Promise<PairData | null> {
    try {
      const pairAddress = await this.factory.getPair(token0Address, token1Address);
      if (pairAddress === ethers.ZeroAddress) return null;

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, this.provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, this.provider);

      const [reserves, t0Symbol, t1Symbol, t0Decimals, t1Decimals] = await Promise.all([
        pair.getReserves(),
        token0Contract.symbol().catch(() => "???"),
        token1Contract.symbol().catch(() => "???"),
        token0Contract.decimals().catch(() => 18),
        token1Contract.decimals().catch(() => 18),
      ]);

      const reserve0 = reserves[0];
      const reserve1 = reserves[1];

      const r0Formatted = parseFloat(ethers.formatUnits(reserve0, t0Decimals));
      const r1Formatted = parseFloat(ethers.formatUnits(reserve1, t1Decimals));

      const priceToken0InToken1 = r0Formatted > 0 ? r1Formatted / r0Formatted : 0;
      const priceToken1InToken0 = r1Formatted > 0 ? r0Formatted / r1Formatted : 0;

      // Estimate USD liquidity (using DAI/USDT/USDC reserves if one side is stablecoin)
      let liquidityUSD = 0;
      const stables = [ETHEREUM_TOKENS.DAI.toLowerCase(), ETHEREUM_TOKENS.USDT.toLowerCase(), ETHEREUM_TOKENS.USDC.toLowerCase()];
      if (stables.includes(token0Address.toLowerCase())) {
        liquidityUSD = r0Formatted * 2;
      } else if (stables.includes(token1Address.toLowerCase())) {
        liquidityUSD = r1Formatted * 2;
      } else {
        // Estimate via ETH price
        const ethPrice = await this.getETHPrice();
        if (token0Address.toLowerCase() === ETHEREUM_TOKENS.WETH.toLowerCase()) {
          liquidityUSD = r0Formatted * ethPrice * 2;
        } else if (token1Address.toLowerCase() === ETHEREUM_TOKENS.WETH.toLowerCase()) {
          liquidityUSD = r1Formatted * ethPrice * 2;
        }
      }

      return {
        pairAddress,
        token0: token0Address,
        token1: token1Address,
        reserve0,
        reserve1,
        token0Symbol: t0Symbol,
        token1Symbol: t1Symbol,
        token0Decimals: Number(t0Decimals),
        token1Decimals: Number(t1Decimals),
        priceToken0InToken1,
        priceToken1InToken0,
        liquidityUSD,
      };
    } catch (error: any) {
      console.warn(`[Uniswap] Pair data failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Monitor multiple token prices for portfolio tracking
   */
  async getPortfolioPrices(tokens: string[]): Promise<TokenPrice[]> {
    const results: TokenPrice[] = [];

    for (const token of tokens) {
      try {
        const price = await this.getTokenPriceUSD(token);
        const pairAddr = await this.factory.getPair(token, ETHEREUM_TOKENS.WETH).catch(() => ethers.ZeroAddress);

        // Get token symbol
        const tokenContract = new ethers.Contract(token, ERC20_ABI, this.provider);
        const symbol = await tokenContract.symbol().catch(() => "???");

        // Get pair liquidity
        let liquidityUSD = 0;
        if (pairAddr !== ethers.ZeroAddress) {
          const pair = new ethers.Contract(pairAddr, PAIR_ABI, this.provider);
          const reserves = await pair.getReserves();
          const ethPrice = await this.getETHPrice();
          // Assume token1 is WETH (common on Uniswap V2)
          const ethReserve = parseFloat(ethers.formatEther(reserves[1]));
          liquidityUSD = ethReserve * ethPrice * 2;
        }

        results.push({
          symbol,
          address: token,
          priceUSD: price,
          liquidityUSD,
          pairAddress: pairAddr,
        });
      } catch (error: any) {
        console.warn(`[Uniswap] Failed for ${token}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get total pairs on Uniswap V2 (shows DEX depth)
   */
  async getTotalPairs(): Promise<number> {
    try {
      const count = await this.factory.allPairsLength();
      return Number(count);
    } catch {
      return 0;
    }
  }

  /**
   * Analyze a token pair for DeFi risks
   */
  async analyzeTokenRisk(tokenAddress: string): Promise<{
    price: number;
    liquidity: number;
    isLowLiquidity: boolean;
    concentration: number;
    flags: string[];
  }> {
    const flags: string[] = [];
    const price = await this.getTokenPriceUSD(tokenAddress);

    const pairData = await this.getPairData(tokenAddress, ETHEREUM_TOKENS.WETH);
    const liquidity = pairData?.liquidityUSD ?? 0;

    if (liquidity < 10000) flags.push("CRITICAL_LOW_LIQUIDITY");
    else if (liquidity < 100000) flags.push("LOW_LIQUIDITY");

    if (price === 0) flags.push("NO_PRICE_FEED");

    // Check token supply concentration
    let concentration = 0;
    try {
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const totalSupply = await token.totalSupply();
      // Check if pair contract holds a very small % (low liquidity lock)
      if (pairData) {
        const pairBalance = await token.balanceOf(pairData.pairAddress);
        const pairPct = Number((pairBalance * 10000n) / totalSupply) / 100;
        if (pairPct < 1) flags.push("NEGLIGIBLE_LIQUIDITY_LOCK");
        concentration = 100 - pairPct;
      }
    } catch {
      flags.push("CONTRACT_READ_FAILED");
    }

    return {
      price,
      liquidity,
      isLowLiquidity: liquidity < 100000,
      concentration,
      flags,
    };
  }
}