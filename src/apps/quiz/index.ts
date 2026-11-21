import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

export const quizApp = new Hono<{ Bindings: Env }>();

quizApp.use('*', cors({
  origin: ['https://quiz.hasit.in'],
  credentials: true,
}));

quizApp.get('/', (c) => {
  return c.json({ 
    name: 'Quiz', 
    tagline: 'Learn by playing',
    status: 'coming soon',
  });
});

quizApp.get('/health', (c) => c.json({ status: 'ok', app: 'quiz' }));