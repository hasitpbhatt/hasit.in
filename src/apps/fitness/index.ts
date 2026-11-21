import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

export const fitnessApp = new Hono<{ Bindings: Env }>();

fitnessApp.use('*', cors({
  origin: ['https://fitness.hasit.in'],
  credentials: true,
}));

fitnessApp.get('/', (c) => {
  return c.json({ 
    name: 'Fitness', 
    tagline: 'Workouts, stats, goals',
    status: 'coming soon',
  });
});

fitnessApp.get('/health', (c) => c.json({ status: 'ok', app: 'fitness' }));