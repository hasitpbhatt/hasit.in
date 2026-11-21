import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

export const gamesApp = new Hono<{ Bindings: Env }>();

gamesApp.use('*', cors({
  origin: ['https://games.hasit.in'],
  credentials: true,
}));

gamesApp.get('/', (c) => {
  return c.json({ 
    name: 'Games', 
    tagline: 'Browser games, leaderboards',
    status: 'coming soon',
  });
});

gamesApp.get('/health', (c) => c.json({ status: 'ok', app: 'games' }));