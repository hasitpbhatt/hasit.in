import type { Env } from '../env';

export interface CoinGeckoPrice {
  usd: number;
  usd_24h_change: number;
  btc: number;
  last_updated: number;
}

const COINGECKO_IDS: Record<string, string> = {
  TRX: 'tron',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  USDT: 'tether',
  DOGE: 'dogecoin',
  BCH: 'bitcoin-cash',
  LTC: 'litecoin',
  DASH: 'dash',
  DGB: 'digibyte',
  ZEC: 'zcash',
};

// 15 minutes: /api/price feeds reward sizing, so avoid hammering CoinGecko.
const CACHE_TTL = 900; // seconds

export const coingecko = {
  async getPrice(env: Env, symbol: string): Promise<CoinGeckoPrice | null> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) return null;

    const cacheKey = `price:${id}`;
    
    // Try KV cache first
    const cached = await env.KV.get(cacheKey, { type: 'json' }) as CoinGeckoPrice | null;
    if (cached && cached.last_updated > Date.now() / 1000 - CACHE_TTL) {
      return cached;
    }

    // Fetch from CoinGecko
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd,btc&include_24hr_change=true`;
      const response = await fetch(url, { headers: { 'User-Agent': 'hasit-in/1.0' } });
      
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
      
      const data = await response.json() as Record<string, { usd: number; btc: number; usd_24h_change: number }>;
      const priceData = data[id];
      
      if (!priceData) return null;

      const result: CoinGeckoPrice = {
        usd: priceData.usd,
        usd_24h_change: priceData.usd_24h_change ?? 0,
        btc: priceData.btc,
        last_updated: Date.now() / 1000,
      };

      // Cache for 60 seconds
      await env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
      
      return result;
    } catch (err) {
      console.error('CoinGecko price fetch error:', err);
      // Return stale cache if available
      if (cached) return cached;
      return null;
    }
  },

  async getMultiplePrices(env: Env, symbols: string[]): Promise<Record<string, CoinGeckoPrice>> {
    const results: Record<string, CoinGeckoPrice> = {};
    
    // Check cache for all
    const toFetch: string[] = [];
    for (const symbol of symbols) {
      const id = COINGECKO_IDS[symbol.toUpperCase()];
      if (!id) continue;
      
      const cacheKey = `price:${id}`;
      const cached = await env.KV.get(cacheKey, { type: 'json' }) as CoinGeckoPrice | null;
      if (cached && cached.last_updated > Date.now() / 1000 - CACHE_TTL) {
        results[symbol] = cached;
      } else {
        toFetch.push(symbol);
      }
    }

    // Fetch missing
    if (toFetch.length > 0) {
      const ids = toFetch.map(s => COINGECKO_IDS[s.toUpperCase()]).filter(Boolean).join(',');
      if (ids) {
        try {
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,btc&include_24hr_change=true`;
          const response = await fetch(url, { headers: { 'User-Agent': 'hasit-in/1.0' } });
          
          if (response.ok) {
            const data = await response.json() as Record<string, { usd: number; btc: number; usd_24h_change: number }>;
            
            for (const symbol of toFetch) {
              const id = COINGECKO_IDS[symbol.toUpperCase()];
              const priceData = data[id];
              if (priceData) {
                const result: CoinGeckoPrice = {
                  usd: priceData.usd,
                  usd_24h_change: priceData.usd_24h_change ?? 0,
                  btc: priceData.btc,
                  last_updated: Date.now() / 1000,
                };
                results[symbol] = result;
                await env.KV.put(`price:${id}`, JSON.stringify(result), { expirationTtl: CACHE_TTL });
              }
            }
          }
        } catch (err) {
          console.error('CoinGecko batch fetch error:', err);
        }
      }
    }

    return results;
  },

  formatPrice(price: CoinGeckoPrice | null, _symbol: string): string {
    if (!price) return 'N/A';
    
    const change = price.usd_24h_change >= 0 ? `+${price.usd_24h_change.toFixed(2)}%` : `${price.usd_24h_change.toFixed(2)}%`;
    const changeColor = price.usd_24h_change >= 0 ? '#2E9E5B' : '#D14B4B';
    return `$${price.usd.toFixed(4)} <span style="color:${changeColor}">(${change})</span> | ₿${price.btc.toFixed(8)}`;
  },
};