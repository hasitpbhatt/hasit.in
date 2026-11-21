// TRX address validation (Tron mainnet addresses start with T, 34 chars base58)
export function isValidTRXAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Tron addresses: start with T, 34 characters, base58 (no 0, O, I, l)
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed);
}

// Generic address validation for other currencies
export function isValidAddress(currency: string, address: string): boolean {
  switch (currency.toUpperCase()) {
    case 'TRX':
      return isValidTRXAddress(address);
    case 'BTC':
      return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
    case 'ETH':
    case 'BNB':
    case 'USDT':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'DOGE':
      return /^D[5-9A-HJ-NP-U]{33}$/.test(address);
    case 'LTC':
      return /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(address);
    default:
      return address.length >= 20 && address.length <= 100;
  }
}

// Turnstile verification
export async function verifyTurnstile(token: string, secret: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  
  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as { success: boolean; 'error-codes'?: string[] };
    return result.success === true;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

// hCaptcha verification (fallback)
export async function verifyHCaptcha(token: string, secret: string): Promise<boolean> {
  if (!token) return false;
  
  try {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);

    const response = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json() as { success: boolean };
    return result.success === true;
  } catch (err) {
    console.error('hCaptcha verification error:', err);
    return false;
  }
}

// Rate limiting helpers
export function getClientIP(request: Request): string {
  // Cloudflare sets these headers
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;
  
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;
  
  return 'unknown';
}

// Sanitize input
export function sanitizeInput(input: string, maxLength = 255): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"'&]/g, '');
}

// Format TRX amounts
export function formatTRX(satoshi: number): string {
  const trx = satoshi / 1_000_000;
  if (trx >= 1) return `${trx.toFixed(6)} TRX`;
  return `${satoshi} sun`;
}

export function formatSatoshi(satoshi: number): string {
  if (satoshi >= 1_000_000) {
    return `${(satoshi / 1_000_000).toFixed(6)} TRX`;
  }
  return `${satoshi.toLocaleString()} sun`;
}

// Parse reward ranges
export interface RewardRange {
  weight: number;
  min: number;
  max: number;
}

export function parseRewards(rewardsStr: string): RewardRange[] {
  const rewards: RewardRange[] = [];
  const parts = rewardsStr.split(',').map(p => p.trim());
  
  for (const part of parts) {
    // Faucet-in-a-BOX format is `range*weight`, e.g. `3304-99113*98.95`
    // means "pick from 3304..99113 with weight 98.95".
    const [rangeStr, weightStr] = part.split('*');
    if (!rangeStr || !weightStr) continue;

    const weight = parseFloat(weightStr);
    if (isNaN(weight) || weight <= 0) continue;

    if (rangeStr.includes('-')) {
      const [min, max] = rangeStr.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        rewards.push({ weight, min, max });
      }
    } else {
      const value = parseInt(rangeStr);
      if (!isNaN(value)) {
        rewards.push({ weight, min: value, max: value });
      }
    }
  }
  
  return rewards;
}

export function pickReward(ranges: RewardRange[]): number {
  const totalWeight = ranges.reduce((sum, r) => sum + r.weight, 0);
  const random = Math.random() * totalWeight;
  
  let cumulative = 0;
  for (const range of ranges) {
    cumulative += range.weight;
    if (random <= cumulative) {
      if (range.min === range.max) return range.min;
      return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    }
  }
  
  return ranges[0]?.min ?? 0;
}

// Format rewards for display
export function formatRewardsDisplay(ranges: RewardRange[]): string {
  const totalWeight = ranges.reduce((sum, r) => sum + r.weight, 0);
  return ranges.map(r => {
    const pct = ((r.weight / totalWeight) * 100).toFixed(2);
    if (r.min === r.max) {
      return `${formatSatoshi(r.min)} (${pct}%)`;
    }
    return `${formatSatoshi(r.min)}-${formatSatoshi(r.max)} (${pct}%)`;
  }).join(', ');
}