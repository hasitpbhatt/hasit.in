import type { D1Database } from '@cloudflare/workers-types';

/** Build a settings lookup from trx_settings rows. */
export function toSettingsMap(rows: Record<string, unknown>[]): Map<string, string> {
  return new Map(
    rows.map((row): [string, string] => [String(row.name ?? ''), String(row.value ?? '')])
  );
}

// TRX Faucet queries (existing tables with trx_ prefix)
export const trx = {
  settings: {
    get: (db: D1Database, name: string) =>
      db.prepare('SELECT value FROM trx_settings WHERE name = ?').bind(name).first(),
    set: (db: D1Database, name: string, value: string) =>
      db.prepare('INSERT OR REPLACE INTO trx_settings (name, value) VALUES (?, ?)').bind(name, value).run(),
    getAll: (db: D1Database) =>
      db.prepare('SELECT name, value FROM trx_settings').all(),
  },

  claimlog: {
    insert: (db: D1Database, data: { address: string; ip: string; reward: number }) =>
      db.prepare('INSERT INTO trx_claimlog (address, ip, time, reward) VALUES (?, ?, unixepoch(), ?)')
        .bind(data.address, data.ip, data.reward).run(),
    recent: (db: D1Database, limit = 10) =>
      db.prepare('SELECT address, time, reward FROM trx_claimlog WHERE address != \'\' ORDER BY id DESC LIMIT ?')
        .bind(limit).all(),
    byAddress: (db: D1Database, address: string, limit = 50) =>
      db.prepare('SELECT * FROM trx_claimlog WHERE address = ? ORDER BY time DESC LIMIT ?')
        .bind(address, limit).all(),
    byIp: (db: D1Database, ip: string, limit = 50) =>
      db.prepare('SELECT * FROM trx_claimlog WHERE ip = ? ORDER BY time DESC LIMIT ?')
        .bind(ip, limit).all(),
    countLast24h: (db: D1Database, address: string, ip: string) =>
      db.prepare('SELECT COUNT(*) as count FROM trx_claimlog WHERE (address = ? OR ip = ?) AND time > ?')
        .bind(address, ip, Date.now() / 1000 - 86400).first(),
    getBalance: (db: D1Database) =>
      db.prepare('SELECT value FROM trx_settings WHERE name = \'balance\'').first(),
    setBalance: (db: D1Database, balance: string) =>
      db.prepare('INSERT OR REPLACE INTO trx_settings (name, value) VALUES (\'balance\', ?)').bind(balance).run(),
  },

  ips: {
    getLastUsed: (db: D1Database, ip: string) =>
      db.prepare('SELECT last_used FROM trx_ips WHERE ip = ?').bind(ip).first(),
    setLastUsed: (db: D1Database, ip: string) =>
      db.prepare('INSERT OR REPLACE INTO trx_ips (ip, last_used) VALUES (?, unixepoch())').bind(ip).run(),
  },

  addresses: {
    getLastUsed: (db: D1Database, address: string) =>
      db.prepare('SELECT last_used, ref_id FROM trx_addresses WHERE address = ?').bind(address).first(),
    setLastUsed: (db: D1Database, address: string, refId?: number) => {
      if (refId) {
        return db.prepare('INSERT OR REPLACE INTO trx_addresses (address, last_used, ref_id) VALUES (?, unixepoch(), ?)')
          .bind(address, refId).run();
      }
      return db.prepare('INSERT OR REPLACE INTO trx_addresses (address, last_used) VALUES (?, unixepoch())')
        .bind(address).run();
    },
  },

  streaks: {
    get: (db: D1Database, address: string) =>
      db.prepare('SELECT streak, last_claim_day FROM trx_streaks WHERE address = ?').bind(address)
        .first() as Promise<{ streak: number; last_claim_day: number } | null>,
    upsert: (db: D1Database, address: string, streak: number, day: number) =>
      db.prepare(`
        INSERT INTO trx_streaks (address, streak, last_claim_day)
        VALUES (?, ?, ?)
        ON CONFLICT(address) DO UPDATE SET streak = excluded.streak, last_claim_day = excluded.last_claim_day
      `).bind(address, streak, day).run(),
  },

  refs: {
    getByAddress: (db: D1Database, address: string) =>
      db.prepare('SELECT id FROM trx_refs WHERE address = ?').bind(address).first(),
    create: (db: D1Database, address: string) =>
      db.prepare('INSERT OR IGNORE INTO trx_refs (address) VALUES (?)').bind(address).run(),
    getReferredUsers: (db: D1Database, refAddress: string) =>
      db.prepare(`
        SELECT a.address, a.last_used 
        FROM trx_refs r 
        LEFT JOIN trx_addresses a ON r.id = a.ref_id 
        WHERE r.address = ? 
        ORDER BY a.last_used DESC
      `).bind(refAddress).all(),
    countReferred: (db: D1Database) =>
      db.prepare('SELECT COUNT(*) as count FROM trx_addresses WHERE ref_id IS NOT NULL').first(),
  },

  locks: {
    acquire: (db: D1Database, kind: 'ip' | 'address', key: string, ttlMinutes = 5) =>
      db.prepare(`
        INSERT OR REPLACE INTO trx_locks (kind, key, expires_at)
        VALUES (?, ?, unixepoch() + ? * 60)
      `).bind(kind, key, ttlMinutes).run(),
    release: (db: D1Database, kind: 'ip' | 'address', key: string) =>
      db.prepare('DELETE FROM trx_locks WHERE kind = ? AND key = ?').bind(kind, key).run(),
    isLocked: (db: D1Database, kind: 'ip' | 'address', key: string) =>
      db.prepare('SELECT 1 FROM trx_locks WHERE kind = ? AND key = ? AND expires_at > unixepoch()')
        .bind(kind, key).first(),
  },

  pages: {
    getAll: (db: D1Database) =>
      db.prepare('SELECT url_name, name, html FROM trx_pages ORDER BY id').all(),
    getByUrlName: (db: D1Database, urlName: string) =>
      db.prepare('SELECT url_name, name, html FROM trx_pages WHERE url_name = ?').bind(urlName).first(),
  },

  analytics: {
    track: (db: D1Database, data: { userId: number; app: string; event: string; properties?: object; sessionId?: string }) =>
      db.prepare(`
        INSERT INTO analytics_events (user_id, app, event, properties, session_id)
        VALUES (?, ?, ?, ?, ?)
      `).bind(data.userId, data.app, data.event, JSON.stringify(data.properties ?? {}), data.sessionId ?? null).run(),
    getEvents: (db: D1Database, app: string, event?: string, limit = 100) => {
      if (event) {
        return db.prepare('SELECT * FROM analytics_events WHERE app = ? AND event = ? ORDER BY created_at DESC LIMIT ?')
          .bind(app, event, limit).all();
      }
      return db.prepare('SELECT * FROM analytics_events WHERE app = ? ORDER BY created_at DESC LIMIT ?')
        .bind(app, limit).all();
    },
    funnel: (db: D1Database, app: string, events: string[]) =>
      db.prepare(`
        SELECT event, COUNT(DISTINCT user_id) as users, COUNT(*) as total
        FROM analytics_events WHERE app = ? AND event IN (${events.map(() => '?').join(',')})
        GROUP BY event
      `).bind(app, ...events).all(),
  },
};