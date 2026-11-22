import type { Env } from '../env';

const FP_API_BASE = 'https://faucetpay.io/api/v1';

/**
 * FaucetPay v1 REST client.
 *
 * Every endpoint is a form-encoded POST and answers with a JSON envelope
 * `{ status, message, ... }` where `status === 200` means success.
 * Docs: https://faucetpay.io/api-docs
 */

export interface FaucetPayBalance {
  balance: string;
  balance_bitcoin?: string;
  currency?: string;
}

export interface FaucetPaySendResult {
  success: boolean;
  message?: string;
  user_hash?: string;
  payout_id?: string | number;
  balance?: FaucetPayBalance;
  status?: number;
  html?: string;
  html_coin?: string;
}

interface FaucetPayEnvelope {
  status?: number;
  message?: string;
  currency?: string;
  balance?: string;
  balance_bitcoin?: string;
  user_hash?: string;
  payout_id?: string | number;
  html?: string;
  html_coin?: string;
}

async function fpPost(env: Env, endpoint: string, params: Record<string, string>): Promise<FaucetPayEnvelope> {
  const apiKey = env.FAUCETPAY_API_KEY;
  if (!apiKey) throw new Error('FaucetPay API key not configured');

  const body = new URLSearchParams({ api_key: apiKey, ...params });

  const response = await fetch(`${FP_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'hasit-in/1.0',
    },
    body: body.toString(),
    // Never let a slow provider stall a page render; getBalance() falls back
    // to the stored value when this fires.
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    throw new Error(`FaucetPay HTTP ${response.status}`);
  }

  return (await response.json()) as FaucetPayEnvelope;
}

/** Local-development payout simulator, only active when FAUCETPAY_MOCK=1. */
function isMocked(env: Env): boolean {
  return env.ENVIRONMENT === 'development' && env.FAUCETPAY_MOCK === '1';
}

export const faucetpay = {
  async getBalance(env: Env): Promise<FaucetPayBalance | null> {
    if (isMocked(env)) {
      return { balance: '1000000000', balance_bitcoin: '1000', currency: 'TRX' };
    }
    try {
      const result = await fpPost(env, '/balance', { currency: 'TRX' });
      if (result.status === 200) {
        return {
          balance: result.balance ?? '0',
          balance_bitcoin: result.balance_bitcoin,
          currency: result.currency,
        };
      }
      if (result.status === 403 || result.status === 452) {
        return { balance: '0', balance_bitcoin: '0' };
      }
      return null;
    } catch (err) {
      console.error('FaucetPay getBalance error:', err);
      return null;
    }
  },

  /**
   * Send coins to a FaucetPay user / address.
   * `amountSatoshi` is in the coin's smallest unit (sun for TRX).
   */
  async sendCoins(
    env: Env,
    to: string,
    amountSatoshi: number,
    ip: string
  ): Promise<FaucetPaySendResult> {
    if (isMocked(env)) {
      return { success: true, message: 'Mock payout (local development)', status: 200 };
    }
    try {
      const result = await fpPost(env, '/send', {
        to,
        amount: String(amountSatoshi),
        currency: 'TRX',
        ip_address: ip,
      });

      return {
        success: result.status === 200,
        message: result.message,
        user_hash: result.user_hash,
        payout_id: result.payout_id,
        balance: result.balance
          ? { balance: result.balance, balance_bitcoin: result.balance_bitcoin, currency: result.currency }
          : undefined,
        status: result.status,
        html: result.html,
        html_coin: result.html_coin,
      };
    } catch (err) {
      console.error('FaucetPay sendCoins error:', err);
      return { success: false, message: 'Payment service unavailable' };
    }
  },

  /** Referral commissions are ordinary payouts from the faucet balance. */
  async sendReferralEarnings(
    env: Env,
    to: string,
    amountSatoshi: number,
    ip: string
  ): Promise<FaucetPaySendResult> {
    return faucetpay.sendCoins(env, to, amountSatoshi, ip);
  },
};
