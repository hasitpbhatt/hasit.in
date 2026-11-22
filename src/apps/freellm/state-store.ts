import type { FreellmStateStore } from '../../../apps/freellm/functions/lib/types'

type StoredValue = { value: string; expires_at_ms: number | null }

export class D1FreellmStateStore implements FreellmStateStore {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async get(key: string): Promise<string | null>
  async get(key: string, type: 'text'): Promise<string | null>
  async get(key: string, type: 'json'): Promise<unknown | null>
  async get(key: string, type: 'text' | 'json' = 'text'): Promise<string | unknown | null> {
    const row = await this.db
      .prepare('SELECT value, expires_at_ms FROM freellm_runtime_state WHERE key = ?')
      .bind(key)
      .first<StoredValue>()
    if (!row) return null
    if (row.expires_at_ms !== null && row.expires_at_ms <= Date.now()) {
      await this.delete(key)
      return null
    }
    return type === 'json' ? JSON.parse(row.value) : row.value
  }

  async put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number },
  ): Promise<void> {
    const expiresAt = options?.expiration !== undefined
      ? options.expiration * 1000
      : options?.expirationTtl !== undefined
        ? Date.now() + options.expirationTtl * 1000
        : null
    await this.db
      .prepare(
        `INSERT INTO freellm_runtime_state (key, value, expires_at_ms)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           expires_at_ms = excluded.expires_at_ms`,
      )
      .bind(key, value, expiresAt)
      .run()
  }

  async delete(key: string): Promise<void> {
    await this.db.prepare('DELETE FROM freellm_runtime_state WHERE key = ?').bind(key).run()
  }
}
