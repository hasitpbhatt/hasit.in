const MIN_TTL_MS = 1_000;
const MAX_TTL_MS = 600_000;

export interface AuthStateEntry {
  value: string;
  expiresAt: number;
}

export class AuthState {
  private readonly storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'PUT' && request.method !== 'GET' && request.method !== 'DELETE') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'GET, PUT, DELETE' } }
      );
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');
    if (!path) {
      return Response.json({ error: 'Missing key' }, { status: 400 });
    }

    let key: string;
    try {
      key = decodeURIComponent(path);
    } catch {
      return Response.json({ error: 'Invalid key' }, { status: 400 });
    }

    switch (request.method) {
      case 'PUT': {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid body' }, { status: 400 });
        }

        if (!isRecord(body) || typeof body.value !== 'string' || typeof body.expiresAt !== 'number' || !Number.isFinite(body.expiresAt)) {
          return Response.json({ error: 'Invalid body' }, { status: 400 });
        }

        const now = Date.now();
        const ttlMs = Math.min(Math.max(body.expiresAt - now, MIN_TTL_MS), MAX_TTL_MS);
        const entry: AuthStateEntry = {
          value: body.value,
          expiresAt: now + ttlMs,
        };
        await this.storage.put(key, entry);
        return Response.json({ ok: true, expiresAt: entry.expiresAt });
      }

      case 'GET': {
        const entry = await this.storage.get<AuthStateEntry>(key);
        if (!entry || entry.expiresAt <= Date.now()) {
          await this.storage.delete(key);
          return Response.json({ found: false }, { status: 404 });
        }

        if (url.searchParams.get('consume') === '1') {
          await this.storage.delete(key);
        }
        return Response.json({ found: true, value: entry.value, expiresAt: entry.expiresAt });
      }

      case 'DELETE': {
        await this.storage.delete(key);
        return Response.json({ ok: true });
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
