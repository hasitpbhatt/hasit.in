import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../../env';

import { claimRoutes } from './routes/claim';
import { adminRoutes } from './routes/admin';
import { apiRoutes } from './routes/api';
import { userPageRoutes } from './routes/user-page';
import { securityMiddleware } from '../../middleware/security';

export const trxApp = new Hono<{ Bindings: Env }>();

trxApp.use('*', cors({
  origin: ['https://trx.hasit.in', 'https://trx2.hasit.in'],
  credentials: true,
}));

// IP ban list applies to every faucet request.
trxApp.use('*', securityMiddleware());

trxApp.route('/', claimRoutes);
trxApp.route('/admin', adminRoutes);
trxApp.route('/api', apiRoutes);
trxApp.route('/p', userPageRoutes); // Custom pages at /p/:slug

trxApp.get('/health', (c) => c.json({ status: 'ok', app: 'trx-faucet' }));
