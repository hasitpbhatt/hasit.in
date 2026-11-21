import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

export const blogApp = new Hono<{ Bindings: Env }>();

blogApp.use('*', cors({
  origin: ['https://blog.hasit.in'],
  credentials: true,
}));

blogApp.get('/', (c) => {
  return c.json({ 
    name: 'Blog', 
    tagline: 'Systems, code, occasional poetry',
    status: 'coming soon',
  });
});

blogApp.get('/health', (c) => c.json({ status: 'ok', app: 'blog' }));