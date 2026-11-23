import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';
import { authMiddleware, getUser } from '../../lib/auth';
import { freellm, core } from '../../lib/db/queries';
import quizAiProxy from '../../../apps/quiz/quiz/proxy/worker.js';
import { decryptSecret } from '../../../apps/freellm/functions/lib/crypto';

export const quizApp = new Hono<{ Bindings: Env }>();

quizApp.use('*', cors({
  origin: ['https://quiz.hasit.in'],
  credentials: true,
}));

// AI proxy requires authentication - uses user's FreeLLM API key
quizApp.all('/api/ai', authMiddleware('quiz'), async (c) => {
  const user = getUser(c);
  
  // Get user's core_users ID from their Google sub
  const coreUser = await core.users.findBySub(c.env.DB, user.sub) as { id: number } | null;
  if (!coreUser) {
    return c.json({ 
      error: 'User not found in core database' 
    }, 404);
  }

  // Fetch user's default FreeLLM API key using their core user ID
  const keyRow = await freellm.apiKeys.getDefaultForUser(c.env.DB, coreUser.id) as { key_encrypted: string; key_iv: string } | null;
  if (!keyRow) {
    return c.json({ 
      error: 'No FreeLLM API key configured. Add one at https://freellm.hasit.in/keys' 
    }, 402);
  }

  // Decrypt the key
  const decryptedKey = await decryptSecret(keyRow.key_encrypted, keyRow.key_iv, c.env.ENCRYPTION_KEY);

  // Call the proxy with the decrypted key
  const requestWithKey = new Request(c.req.raw, {
    headers: {
      ...Object.fromEntries(c.req.raw.headers.entries()),
      'X-Freellm-Api-Key': decryptedKey,
    },
  });
  return quizAiProxy.fetch(requestWithKey, c.env);
});

quizApp.get('/', (c) => {
  return c.json({ 
    name: 'Quiz', 
    tagline: 'Learn by playing',
    status: 'coming soon',
  });
});

quizApp.get('/health', (c) => c.json({ status: 'ok', app: 'quiz' }));