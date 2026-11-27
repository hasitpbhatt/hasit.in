import type { D1Database } from '@cloudflare/workers-types';

type CoreUserProfile = {
  email?: string;
  name?: string | null;
  picture?: string | null;
};

type BlogPostUpdate = {
  slug?: string;
  title?: string;
  excerpt?: string | null;
  contentMd?: string;
  contentHtml?: string;
  publishedAt?: number | null;
};

export const core = {
  users: {
    findBySub: (db: D1Database, sub: string) =>
      db.prepare('SELECT * FROM core_users WHERE sub = ?').bind(sub).first(),
    findById: (db: D1Database, id: number) =>
      db.prepare('SELECT * FROM core_users WHERE id = ?').bind(id).first(),
    create: (db: D1Database, data: { sub: string; email: string; name?: string | null; picture?: string | null }) =>
      db.prepare(`
        INSERT INTO core_users (sub, email, name, picture)
        VALUES (?, ?, ?, ?)
        RETURNING *
      `).bind(data.sub, data.email, data.name ?? null, data.picture ?? null).first(),
    updateProfile: (db: D1Database, id: number, data: CoreUserProfile) => {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (data.email !== undefined) {
        fields.push('email = ?');
        values.push(data.email);
      }
      if (data.name !== undefined) {
        fields.push('name = ?');
        values.push(data.name);
      }
      if (data.picture !== undefined) {
        fields.push('picture = ?');
        values.push(data.picture);
      }

      fields.push('updated_at = unixepoch()');
      values.push(id);

      return db.prepare(`UPDATE core_users SET ${fields.join(', ')} WHERE id = ?`)
        .bind(...values).run();
    },
  },

  userApps: {
    listByUser: (db: D1Database, userId: number) =>
      db.prepare(`
        SELECT user_id, app, scope, connected_at, revoked_at
        FROM core_user_apps
        WHERE user_id = ?
        ORDER BY app
      `).bind(userId).all(),
    link: (db: D1Database, data: { userId: number; app: string; refreshToken: string; scope: string }) =>
      db.prepare(`
        INSERT INTO core_user_apps (user_id, app, refresh_token, scope, connected_at)
        VALUES (?, ?, ?, ?, unixepoch())
        ON CONFLICT(user_id, app) DO UPDATE SET
          refresh_token = excluded.refresh_token,
          scope = excluded.scope,
          connected_at = unixepoch(),
          revoked_at = NULL
      `).bind(data.userId, data.app, data.refreshToken, data.scope).run(),
    revoke: (db: D1Database, userId: number, app: string) =>
      db.prepare('UPDATE core_user_apps SET revoked_at = unixepoch() WHERE user_id = ? AND app = ?')
        .bind(userId, app).run(),
    getRefreshToken: (db: D1Database, userId: number, app: string) =>
      db.prepare(`
        SELECT refresh_token
        FROM core_user_apps
        WHERE user_id = ? AND app = ? AND revoked_at IS NULL
      `).bind(userId, app).first(),
  },

  sessions: {
    create: (db: D1Database, data: { id: string; userId: number; app: string; expiresAt: number }) =>
      db.prepare(`
        INSERT INTO core_sessions (id, user_id, app, expires_at)
        VALUES (?, ?, ?, ?)
      `).bind(data.id, data.userId, data.app, data.expiresAt).run(),
    revokeById: (db: D1Database, id: string) =>
      db.prepare('UPDATE core_sessions SET revoked_at = unixepoch() WHERE id = ?').bind(id).run(),
    revokeAllForUserAndApp: (db: D1Database, userId: number, app: string) =>
      db.prepare('UPDATE core_sessions SET revoked_at = unixepoch() WHERE user_id = ? AND app = ?')
        .bind(userId, app).run(),
    deleteExpired: (db: D1Database) =>
      db.prepare('DELETE FROM core_sessions WHERE expires_at <= unixepoch()').run(),
  },
};

export const freellm = {
  validations: {
    insert: (db: D1Database, data: {
      userId: number;
      provider: string;
      model?: string | null;
      success: boolean;
      latencyMs?: number | null;
      error?: string | null;
    }) =>
      db.prepare(`
        INSERT INTO freellm_validations (
          user_id, provider, model, success, latency_ms, error
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        data.userId,
        data.provider,
        data.model ?? null,
        data.success ? 1 : 0,
        data.latencyMs ?? null,
        data.error ?? null,
      ).run(),
    listByUser: (db: D1Database, userId: number, limit = 100) =>
      db.prepare(`
        SELECT *
        FROM freellm_validations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(userId, limit).all(),
    countByProvider: (db: D1Database, provider: string) =>
      db.prepare('SELECT COUNT(*) AS count FROM freellm_validations WHERE provider = ?')
        .bind(provider).first(),
  },

  apiKeys: {
    insert: (db: D1Database, data: {
      userId: number;
      provider: string;
      keyHash: string;
      keyEncrypted: string;
      label?: string | null;
      lastValidated?: number | null;
    }) =>
      db.prepare(`
        INSERT INTO freellm_api_keys (
          user_id, provider, key_hash, key_encrypted, label, last_validated
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        data.userId,
        data.provider,
        data.keyHash,
        data.keyEncrypted,
        data.label ?? null,
        data.lastValidated ?? null,
      ).run(),
    listByUser: (db: D1Database, userId: number) =>
      db.prepare(`
        SELECT *
        FROM freellm_api_keys
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).bind(userId).all(),
    delete: (db: D1Database, id: number) =>
      db.prepare('DELETE FROM freellm_api_keys WHERE id = ?').bind(id).run(),

    /** Get user's first active API key for BYOK usage */
    getDefaultForUser: (db: D1Database, userId: number) =>
      db.prepare(`
        SELECT id, provider, key_hash, key_encrypted, label
        FROM freellm_api_keys
        WHERE user_id = ?
        ORDER BY created_at ASC
        LIMIT 1
      `).bind(userId).first(),
  },
};

export const blog = {
  posts: {
    insert: (db: D1Database, data: {
      slug: string;
      title: string;
      excerpt?: string | null;
      contentMd: string;
      contentHtml: string;
      authorId: number;
      publishedAt?: number | null;
    }) =>
      db.prepare(`
        INSERT INTO blog_posts (
          slug, title, excerpt, content_md, content_html, author_id, published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        data.slug,
        data.title,
        data.excerpt ?? null,
        data.contentMd,
        data.contentHtml,
        data.authorId,
        data.publishedAt ?? null,
      ).first(),
    listPublished: (db: D1Database, limit = 50) =>
      db.prepare(`
        SELECT *
        FROM blog_posts
        WHERE published_at IS NOT NULL
        ORDER BY published_at DESC
        LIMIT ?
      `).bind(limit).all(),
    getBySlug: (db: D1Database, slug: string) =>
      db.prepare('SELECT * FROM blog_posts WHERE slug = ?').bind(slug).first(),
    update: (db: D1Database, id: number, data: BlogPostUpdate) => {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (data.slug !== undefined) {
        fields.push('slug = ?');
        values.push(data.slug);
      }
      if (data.title !== undefined) {
        fields.push('title = ?');
        values.push(data.title);
      }
      if (data.excerpt !== undefined) {
        fields.push('excerpt = ?');
        values.push(data.excerpt);
      }
      if (data.contentMd !== undefined) {
        fields.push('content_md = ?');
        values.push(data.contentMd);
      }
      if (data.contentHtml !== undefined) {
        fields.push('content_html = ?');
        values.push(data.contentHtml);
      }
      if (data.publishedAt !== undefined) {
        fields.push('published_at = ?');
        values.push(data.publishedAt);
      }

      fields.push('updated_at = unixepoch()');
      values.push(id);

      return db.prepare(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id = ?`)
        .bind(...values).run();
    },
  },

  tags: {
    upsert: (db: D1Database, data: { name: string; slug: string }) =>
      db.prepare(`
        INSERT INTO blog_tags (name, slug)
        VALUES (?, ?)
        ON CONFLICT(slug) DO UPDATE SET name = excluded.name
        RETURNING *
      `).bind(data.name, data.slug).first(),
    list: (db: D1Database) =>
      db.prepare('SELECT * FROM blog_tags ORDER BY name').all(),
  },

  postTags: {
    link: (db: D1Database, postId: number, tagId: number) =>
      db.prepare('INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)')
        .bind(postId, tagId).run(),
    listForPost: (db: D1Database, postId: number) =>
      db.prepare(`
        SELECT t.*
        FROM blog_post_tags pt
        JOIN blog_tags t ON t.id = pt.tag_id
        WHERE pt.post_id = ?
        ORDER BY t.name
      `).bind(postId).all(),
  },
};

export const analytics = {
  events: {
    track: (db: D1Database, data: {
      userId?: number | null;
      app: string;
      event: string;
      properties?: Record<string, unknown> | null;
      sessionId?: string | null;
    }) =>
      db.prepare(`
        INSERT INTO analytics_events (user_id, app, event, properties, session_id)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        data.userId ?? null,
        data.app,
        data.event,
        data.properties === null || data.properties === undefined
          ? null
          : JSON.stringify(data.properties),
        data.sessionId ?? null,
      ).run(),
    countByAppEvent: (db: D1Database, app: string, event: string) =>
      db.prepare('SELECT COUNT(*) AS count FROM analytics_events WHERE app = ? AND event = ?')
        .bind(app, event).first(),
    recentByApp: (db: D1Database, app: string, limit = 100) =>
      db.prepare(`
        SELECT *
        FROM analytics_events
        WHERE app = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(app, limit).all(),
    distinctUsersByApp: (db: D1Database, app: string) =>
      db.prepare('SELECT COUNT(DISTINCT user_id) AS count FROM analytics_events WHERE app = ?')
        .bind(app).first(),
  },
};
