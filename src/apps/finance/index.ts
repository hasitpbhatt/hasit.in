import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

export const financeApp = new Hono<{ Bindings: Env }>();

financeApp.use('*', cors({
  origin: ['https://finance.hasit.in'],
  credentials: true,
}));

financeApp.get('/', (c) => {
  return c.json({ 
    name: 'Finance', 
    tagline: 'Portfolio tracker & tools',
    status: 'coming soon',
  });
});

financeApp.get('/health', (c) => c.json({ status: 'ok', app: 'finance' }));