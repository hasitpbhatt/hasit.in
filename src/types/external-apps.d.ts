// Type contracts for source JavaScript modules consumed by Worker adapters.
type FinanceApiEnv = {
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string;
};

declare module '*apps/finance/api/overview.js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/screener.js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/search.js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/crypto.js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/market/sentiment.js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/s/[symbol].js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/detail/[symbol].js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/api/signals/[symbol].js' {
  export function GET(request: Request, env?: FinanceApiEnv): Promise<Response>;
}

declare module '*apps/finance/api/options/[symbol].js' {
  export function GET(request: Request): Promise<Response>;
}

declare module '*apps/finance/lib/http.js' {
  export function corsPreflight(): Response;
}

declare module '*apps/quiz/quiz/proxy/worker.js' {
  const worker: {
    fetch(request: Request, env: { MISTRAL_API_KEY?: string }): Promise<Response>;
  };
  export default worker;
}
