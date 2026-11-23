import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { app as freellmApi } from '../../../apps/freellm/functions/api/[[route]].ts';
import { v1App as freellmV1 } from '../../../apps/freellm/functions/v1/[[route]].ts';
import type { Bindings } from '../../../apps/freellm/functions/lib/types';
import type { Env } from '../../env';
import { D1FreellmStateStore } from './state-store';

export const freellmApp = new Hono<{ Bindings: Env }>();

freellmApp.use('*', cors({
  origin: ['https://freellm.hasit.in'],
  credentials: true,
}));

function freellmBindings(env: Env): Bindings {
  return {
    ...env,
    APP_BASE_PATH: '',
    freellm_sessions: new D1FreellmStateStore(env.DB),
  };
}

freellmApp.all('/api/*', (c) =>
  freellmApi.fetch(c.req.raw, freellmBindings(c.env), c.executionCtx),
);

freellmApp.all('/v1/*', (c) =>
  freellmV1.fetch(c.req.raw, freellmBindings(c.env), c.executionCtx),
);

freellmApp.get('/health', (c) => c.json({ status: 'ok', app: 'freellm' }));
