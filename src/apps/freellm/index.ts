import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

export const freellmApp = new Hono<{ Bindings: Env }>();

freellmApp.use('*', cors({
  origin: ['https://freellm.hasit.in'],
  credentials: true,
}));

freellmApp.get('/', (c) => {
  return c.json({ 
    name: 'FreeLLM', 
    tagline: 'Validate any LLM API key',
    status: 'coming soon',
  });
});

freellmApp.get('/health', (c) => c.json({ status: 'ok', app: 'freellm' }));