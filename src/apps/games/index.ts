import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';
import type { Env } from '../../env';
import { createGamesDatabase } from '../../lib/db/games-database';

import { onRequestPost as guest } from '../../../apps/games/functions/api/guest';
import { onRequestPost as login } from '../../../apps/games/functions/api/login';
import { onRequestPost as logout } from '../../../apps/games/functions/api/logout';
import { onRequestGet as me } from '../../../apps/games/functions/api/me';
import { onRequestGet as payouts } from '../../../apps/games/functions/api/payouts';
import { onRequestPost as redeemCode } from '../../../apps/games/functions/api/redeem-code';
import { onRequestPost as redeem } from '../../../apps/games/functions/api/redeem';
import { onRequestPost as register } from '../../../apps/games/functions/api/register';
import { onRequestPost as score } from '../../../apps/games/functions/api/score';
import {
  onRequestGet as listCodes,
  onRequestPost as createCode,
} from '../../../apps/games/functions/api/admin/codes';
import { onRequestPost as checkPinpoint } from '../../../apps/games/functions/api/pinpoint/check';
import { onRequestPost as undoScore } from '../../../apps/games/functions/api/score/undo';
import { onRequestPost as startSession } from '../../../apps/games/functions/api/session/start';
import { onRequestPost as completeSoul } from '../../../apps/games/functions/api/soul/complete';

export const gamesApp = new Hono<{ Bindings: Env }>();

gamesApp.use('*', cors({
  origin: ['https://games.hasit.in'],
  credentials: true,
}));

type GamesPagesEnv = import('../../../apps/games/functions/_shared/types').Env;
type GamesPageHandler = PagesFunction<GamesPagesEnv>;
type GamesPageContext = Parameters<GamesPageHandler>[0];

function callPages(handler: GamesPageHandler) {
  return async (c: Context<{ Bindings: Env }>): Promise<Response> => {
    const pageContext: GamesPageContext = {
      request: c.req.raw as GamesPageContext['request'],
      functionPath: c.req.path,
      waitUntil: (promise) => c.executionCtx.waitUntil(promise),
      passThroughOnException: () => c.executionCtx.passThroughOnException(),
      next: async () => c.notFound(),
      env: { ...c.env, DB: createGamesDatabase(c.env.DB) },
      params: c.req.param(),
      data: {},
    };
    return handler(pageContext);
  };
}

gamesApp.post('/api/guest', callPages(guest));
gamesApp.post('/api/login', callPages(login));
gamesApp.post('/api/logout', callPages(logout));
gamesApp.get('/api/me', callPages(me));
gamesApp.get('/api/payouts', callPages(payouts));
gamesApp.post('/api/redeem-code', callPages(redeemCode));
gamesApp.post('/api/redeem', callPages(redeem));
gamesApp.post('/api/register', callPages(register));
gamesApp.post('/api/score', callPages(score));
gamesApp.get('/api/admin/codes', callPages(listCodes));
gamesApp.post('/api/admin/codes', callPages(createCode));
gamesApp.post('/api/pinpoint/check', callPages(checkPinpoint));
gamesApp.post('/api/score/undo', callPages(undoScore));
gamesApp.post('/api/session/start', callPages(startSession));
gamesApp.post('/api/soul/complete', callPages(completeSoul));

gamesApp.get('/', (c) => {
  return c.json({ 
    name: 'Games', 
    tagline: 'Browser games, leaderboards',
    status: 'coming soon',
  });
});

gamesApp.get('/health', (c) => c.json({ status: 'ok', app: 'games' }));