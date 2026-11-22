import { Hono, type Context } from 'hono';
import { corsPreflight } from '../../../apps/finance/lib/http.js';
import { GET as overview } from '../../../apps/finance/api/overview.js';
import { GET as screener } from '../../../apps/finance/api/screener.js';
import { GET as search } from '../../../apps/finance/api/search.js';
import { GET as crypto } from '../../../apps/finance/api/crypto.js';
import { GET as marketSentiment } from '../../../apps/finance/api/market/sentiment.js';
import { GET as stockPage } from '../../../apps/finance/api/s/[symbol].js';
import { GET as detail } from '../../../apps/finance/api/detail/[symbol].js';
import { GET as signals } from '../../../apps/finance/api/signals/[symbol].js';
import { GET as options } from '../../../apps/finance/api/options/[symbol].js';
import type { Env } from '../../env';

type FinanceHandler = (request: Request, env: Env) => Promise<Response>;
type FinanceContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

function callHandler(handler: FinanceHandler) {
  return (context: FinanceContext) => handler(context.req.raw, context.env);
}

app.get('/api/overview', callHandler(overview));
app.get('/api/screener', callHandler(screener));
app.get('/api/search', callHandler(search));
app.get('/api/crypto', callHandler(crypto));
app.get('/api/market/sentiment', callHandler(marketSentiment));
app.get('/s/:symbol', callHandler(stockPage));
app.get('/api/s/:symbol', callHandler(stockPage));
app.get('/api/detail/:symbol', callHandler(detail));
app.get('/api/signals/:symbol', callHandler(signals));
app.get('/api/options/:symbol', callHandler(options));
app.options('/api/*', () => corsPreflight());

app.get('/', (context) => context.json({ name: 'Finance', status: 'ok' }));
app.get('/health', (context) => context.json({ status: 'ok', app: 'finance' }));

export const financeApp = app;
