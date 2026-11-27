import { Hono } from 'hono';
import type { Env } from '../../env.ts';
import { proxyFitness } from '../../lib/fitness-proxy.ts';

type AppEnv = { Bindings: Env };

/**
 * fitness.hasit.in — reverse proxy to the standalone hasitpbhatt/fitness
 * Cloudflare Pages deployment. Nothing is handled locally.
 */
export const fitnessApp = new Hono<AppEnv>();

fitnessApp.all('*', (c) => proxyFitness(c.req.raw, c.env));
