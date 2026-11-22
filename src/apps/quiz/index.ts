import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';
import quizAiProxy from '../../../apps/quiz/quiz/proxy/worker.js';

export const quizApp = new Hono<{ Bindings: Env }>();

quizApp.use('*', cors({
  origin: ['https://quiz.hasit.in'],
  credentials: true,
}));

quizApp.all('/api/ai', (context) => quizAiProxy.fetch(context.req.raw, context.env));

quizApp.get('/', (c) => {
  return c.json({ 
    name: 'Quiz', 
    tagline: 'Learn by playing',
    status: 'coming soon',
  });
});

quizApp.get('/health', (c) => c.json({ status: 'ok', app: 'quiz' }));