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

const CACHE_TTL = 900;
const CACHE_RETENTION_TTL = 86_400;

interface CloudflareCacheStorage extends CacheStorage {
  readonly default: Cache;
}

const localCache = new Map<string, { value: CoinGeckoPrice; expiresAt: number }>();
const inFlight = new Map<string, Promise<CoinGeckoPrice | null>>();

function getEdgeCache(): Cache | null {
  return typeof caches === 'undefined' ? null : (caches as CloudflareCacheStorage).default;
}

function cacheRequest(id: string): Request {
  return new Request(`https://hasit-in-cache.invalid/coingecko/${id}`);
}

function isPrice(value: unknown): value is CoinGeckoPrice {
  if (!value || typeof value !== 'object') return false;
  const price = value as Record<string, unknown>;
  return (
    typeof price.usd === 'number' &&
    typeof price.usd_24h_change === 'number' &&
    typeof price.btc === 'number' &&
    typeof price.last_updated === 'number'
  );
}

async function readCache(id: string): Promise<CoinGeckoPrice | null> {
  const key = `price:${id}`;
  const cache = getEdgeCache();
  if (cache) {
    try {
      const response = await cache.match(cacheRequest(id));
      if (response) {
        const value: unknown = await response.json();
        if (isPrice(value)) {
          localCache.set(key, { value, expiresAt: Date.now() + CACHE_RETENTION_TTL * 1000 });
          return value;
        }
      }
    } catch (error) {
      console.warn('CoinGecko edge-cache read failed:', error);
    }
  }

  const entry = localCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  if (entry) localCache.delete(key);
  return null;
}

async function writeCache(id: string, value: CoinGeckoPrice): Promise<void> {
  const key = `price:${id}`;
  localCache.set(key, { value, expiresAt: Date.now() + CACHE_RETENTION_TTL * 1000 });

  const cache = getEdgeCache();
  if (cache) {
    try {
      await cache.put(
        cacheRequest(id),
        new Response(JSON.stringify(value), {
          headers: {
            'Cache-Control': `public, max-age=${CACHE_RETENTION_TTL}`,
            'Content-Type': 'application/json',
          },
        })
      );
    } catch (error) {
      console.warn('CoinGecko edge-cache write failed:', error);
    }
  }
}

async function fetchPrices(ids: string[]): Promise<Record<string, CoinGeckoPrice>> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd,btc&include_24hr_change=true`;
  const response = await fetch(url, { headers: { 'User-Agent': 'hasit-in/1.0' } });
  if (!response.ok) throw new Error(`CoinGecko ${response.status}`);

  const data = (await response.json()) as Record<
    string,
    { usd: number; btc: number; usd_24h_change?: number }
  >;
  const now = Date.now() / 1000;
  const prices: Record<string, CoinGeckoPrice> = {};

  for (const id of ids) {
    const price = data[id];
    if (!price) continue;
    prices[id] = {
      usd: price.usd,
      usd_24h_change: price.usd_24h_change ?? 0,
      btc: price.btc,
      last_updated: now,
    };
  }

  return prices;
}

function isFresh(price: CoinGeckoPrice): boolean {
  return price.last_updated > Date.now() / 1000 - CACHE_TTL;
}

export const coingecko = {
  async getPrice(env: Env, symbol: string): Promise<CoinGeckoPrice | null> {
    const id = COINGECKO_IDS[symbol.toUpperCase()];
    if (!id) return null;

    const cached = await readCache(id);
    if (cached && isFresh(cached)) return cached;

    const pending = inFlight.get(id);
    if (pending) return pending;

    const request = (async () => {
      try {
        const prices = await fetchPrices([id]);
        const price = prices[id];
        if (!price) return null;
        await writeCache(id, price);
        return price;
      } catch (error) {
        console.error('CoinGecko price fetch error:', error);
        return cached;
      }
    })();

    inFlight.set(id, request);
    try {
      return await request;
    } finally {
      inFlight.delete(id);
    }
  },

  async getMultiplePrices(env: Env, symbols: string[]): Promise<Record<string, CoinGeckoPrice>> {
    const idsBySymbol = new Map<string, string>();
    for (const symbol of symbols) {
      const id = COINGECKO_IDS[symbol.toUpperCase()];
      if (id) idsBySymbol.set(symbol, id);
    }

    const uniqueIds = [...new Set(idsBySymbol.values())];
    const cachedPrices = await Promise.all(uniqueIds.map(async (id) => [id, await readCache(id)] as const));
    const byId = new Map(cachedPrices);
    const results: Record<string, CoinGeckoPrice> = {};
    const toFetch = uniqueIds.filter((id) => !byId.get(id) || !isFresh(byId.get(id)!));

    for (const [symbol, id] of idsBySymbol) {
      const price = byId.get(id);
      if (price && isFresh(price)) results[symbol] = price;
    }

    if (toFetch.length > 0) {
      try {
        const prices = await fetchPrices(toFetch);
        for (const id of toFetch) {
          const price = prices[id];
          if (price) {
            byId.set(id, price);
            await writeCache(id, price);
          }
        }
      } catch (error) {
        console.error('CoinGecko batch fetch error:', error);
      }
    }

    for (const [symbol, id] of idsBySymbol) {
      const price = byId.get(id);
      if (price) results[symbol] = price;
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
