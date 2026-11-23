import type { D1Database } from '@cloudflare/workers-types';

type CoreUserProfile = {
  email?: string;
  name?: string | null;
  picture?: string | null;
};

type WorkoutInput = {
  userId: number;
  source: string;
  sourceId?: string | null;
  type: string;
  startedAt: number;
  durationSec: number;
  distanceM?: number | null;
  calories?: number | null;
  hrAvg?: number | null;
  hrMax?: number | null;
  elevationM?: number | null;
  rawJson?: string | null;
};

type GoalInput = {
  userId: number;
  metric: string;
  target: number;
  periodStart: number;
  periodEnd: number;
};

type TransactionInput = {
  portfolioId: number;
  symbol: string;
  type: string;
  quantity: number;
  price: number;
  fees?: number;
  executedAt: number;
};

type QuestionInput = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
  orderIndex?: number;
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

export const fitness = {
  workouts: {
    insert: (db: D1Database, data: WorkoutInput) =>
      db.prepare(`
        INSERT INTO fitness_workouts (
          user_id, source, source_id, type, started_at, duration_sec,
          distance_m, calories, hr_avg, hr_max, elevation_m, raw_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.userId,
        data.source,
        data.sourceId ?? null,
        data.type,
        data.startedAt,
        data.durationSec,
        data.distanceM ?? null,
        data.calories ?? null,
        data.hrAvg ?? null,
        data.hrMax ?? null,
        data.elevationM ?? null,
        data.rawJson ?? null,
      ).run(),
    listByUser: (db: D1Database, userId: number, limit = 50) =>
      db.prepare(`
        SELECT *
        FROM fitness_workouts
        WHERE user_id = ?
        ORDER BY started_at DESC
        LIMIT ?
      `).bind(userId, limit).all(),
    latestByUser: (db: D1Database, userId: number) =>
      db.prepare(`
        SELECT *
        FROM fitness_workouts
        WHERE user_id = ?
        ORDER BY started_at DESC
        LIMIT 1
      `).bind(userId).first(),
    countSinceTimestamp: (db: D1Database, userId: number, since: number) =>
      db.prepare('SELECT COUNT(*) AS count FROM fitness_workouts WHERE user_id = ? AND started_at >= ?')
        .bind(userId, since).first(),
  },

  goals: {
    upsert: async (db: D1Database, data: GoalInput) => {
      const existing = await db.prepare(`
        SELECT id
        FROM fitness_goals
        WHERE user_id = ? AND metric = ?
        LIMIT 1
      `).bind(data.userId, data.metric).first<{ id: number }>();

      if (existing) {
        return db.prepare(`
          UPDATE fitness_goals
          SET target = ?, period_start = ?, period_end = ?
          WHERE id = ?
        `).bind(data.target, data.periodStart, data.periodEnd, existing.id).run();
      }

      return db.prepare(`
        INSERT INTO fitness_goals (
          user_id, metric, target, period_start, period_end
        )
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        data.userId,
        data.metric,
        data.target,
        data.periodStart,
        data.periodEnd,
      ).run();
    },
    listByUser: (db: D1Database, userId: number) =>
      db.prepare(`
        SELECT *
        FROM fitness_goals
        WHERE user_id = ?
        ORDER BY metric
      `).bind(userId).all(),
  },

  streaks: {
    upsert: (db: D1Database, data: {
      userId: number;
      currentStreak: number;
      longestStreak: number;
      lastWorkoutAt?: number | null;
    }) =>
      db.prepare(`
        INSERT INTO fitness_streaks (
          user_id, current_streak, longest_streak, last_workout_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          current_streak = excluded.current_streak,
          longest_streak = excluded.longest_streak,
          last_workout_at = COALESCE(excluded.last_workout_at, fitness_streaks.last_workout_at),
          updated_at = unixepoch()
      `).bind(
        data.userId,
        data.currentStreak,
        data.longestStreak,
        data.lastWorkoutAt ?? null,
      ).run(),
    get: (db: D1Database, userId: number) =>
      db.prepare('SELECT * FROM fitness_streaks WHERE user_id = ?').bind(userId).first(),
  },
};

export const finance = {
  portfolios: {
    create: (db: D1Database, data: { userId: number; name: string; baseCurrency?: string }) =>
      db.prepare(`
        INSERT INTO finance_portfolios (user_id, name, base_currency)
        VALUES (?, ?, ?)
      `).bind(data.userId, data.name, data.baseCurrency ?? 'USD').run(),
    listByUser: (db: D1Database, userId: number) =>
      db.prepare(`
        SELECT *
        FROM finance_portfolios
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).bind(userId).all(),
    delete: (db: D1Database, id: number) =>
      db.prepare('DELETE FROM finance_portfolios WHERE id = ?').bind(id).run(),
  },

  holdings: {
    upsert: (db: D1Database, data: {
      portfolioId: number;
      symbol: string;
      quantity: number;
      avgCost?: number | null;
    }) =>
      db.prepare(`
        INSERT INTO finance_holdings (portfolio_id, symbol, quantity, avg_cost)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(portfolio_id, symbol) DO UPDATE SET
          quantity = excluded.quantity,
          avg_cost = excluded.avg_cost
      `).bind(
        data.portfolioId,
        data.symbol,
        data.quantity,
        data.avgCost ?? null,
      ).run(),
    listByPortfolio: (db: D1Database, portfolioId: number) =>
      db.prepare(`
        SELECT *
        FROM finance_holdings
        WHERE portfolio_id = ?
        ORDER BY symbol
      `).bind(portfolioId).all(),
    delete: (db: D1Database, portfolioId: number, symbol: string) =>
      db.prepare('DELETE FROM finance_holdings WHERE portfolio_id = ? AND symbol = ?')
        .bind(portfolioId, symbol).run(),
  },

  transactions: {
    insert: (db: D1Database, data: TransactionInput) =>
      db.prepare(`
        INSERT INTO finance_transactions (
          portfolio_id, symbol, type, quantity, price, fees, executed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.portfolioId,
        data.symbol,
        data.type,
        data.quantity,
        data.price,
        data.fees ?? 0,
        data.executedAt,
      ).run(),
    listByPortfolio: (db: D1Database, portfolioId: number, limit = 50) =>
      db.prepare(`
        SELECT *
        FROM finance_transactions
        WHERE portfolio_id = ?
        ORDER BY executed_at DESC
        LIMIT ?
      `).bind(portfolioId, limit).all(),
    sumInvested: (db: D1Database, portfolioId: number) =>
      db.prepare(`
        SELECT COALESCE(SUM(quantity * price), 0) AS total
        FROM finance_transactions
        WHERE portfolio_id = ?
      `).bind(portfolioId).first(),
  },
};

export const quiz = {
  quizzes: {
    create: (db: D1Database, data: {
      creatorId: number;
      title: string;
      description?: string | null;
      sourceUrl?: string | null;
      isPublic?: boolean;
    }) =>
      db.prepare(`
        INSERT INTO quiz_quizzes (
          creator_id, title, description, source_url, is_public
        )
        VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        data.creatorId,
        data.title,
        data.description ?? null,
        data.sourceUrl ?? null,
        (data.isPublic ?? true) ? 1 : 0,
      ).first(),
    listPublic: (db: D1Database, limit = 50) =>
      db.prepare(`
        SELECT *
        FROM quiz_quizzes
        WHERE is_public = 1
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all(),
    getById: (db: D1Database, id: number) =>
      db.prepare('SELECT * FROM quiz_quizzes WHERE id = ?').bind(id).first(),
  },

  questions: {
    insertBatch: (db: D1Database, quizId: number, questions: QuestionInput[]) =>
      db.batch(questions.map((question) => db.prepare(`
        INSERT INTO quiz_questions (
          quiz_id, question, options, correct_index, explanation, order_index
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        quizId,
        question.question,
        JSON.stringify(question.options),
        question.correctIndex,
        question.explanation ?? null,
        question.orderIndex ?? 0,
      ))),
    listByQuiz: (db: D1Database, quizId: number) =>
      db.prepare(`
        SELECT *
        FROM quiz_questions
        WHERE quiz_id = ?
        ORDER BY order_index, id
      `).bind(quizId).all(),
  },

  attempts: {
    insert: (db: D1Database, data: {
      quizId: number;
      userId: number;
      score: number;
      answers: number[];
      startedAt?: number;
      completedAt?: number | null;
    }) =>
      db.prepare(`
        INSERT INTO quiz_attempts (
          quiz_id, user_id, score, answers, started_at, completed_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        data.quizId,
        data.userId,
        data.score,
        JSON.stringify(data.answers),
        data.startedAt ?? Math.floor(Date.now() / 1000),
        data.completedAt ?? null,
      ).run(),
    listByQuiz: (db: D1Database, quizId: number) =>
      db.prepare(`
        SELECT *
        FROM quiz_attempts
        WHERE quiz_id = ?
        ORDER BY completed_at DESC, id DESC
      `).bind(quizId).all(),
    bestScoreForUser: (db: D1Database, userId: number, quizId?: number) => {
      if (quizId === undefined) {
        return db.prepare('SELECT MAX(score) AS score FROM quiz_attempts WHERE user_id = ?')
          .bind(userId).first();
      }
      return db.prepare(`
        SELECT score
        FROM quiz_attempts
        WHERE user_id = ? AND quiz_id = ?
        ORDER BY score DESC
        LIMIT 1
      `).bind(userId, quizId).first();
    },
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

export const games = {
  scores: {
    insert: (db: D1Database, data: {
      userId: number;
      game: string;
      score: number;
      metadata?: Record<string, unknown> | null;
    }) =>
      db.prepare(`
        INSERT INTO games_scores (user_id, game, score, metadata)
        VALUES (?, ?, ?, ?)
      `).bind(
        data.userId,
        data.game,
        data.score,
        data.metadata === null || data.metadata === undefined
          ? null
          : JSON.stringify(data.metadata),
      ).run(),
    topScoresByGame: (db: D1Database, game: string, limit = 10) =>
      db.prepare(`
        SELECT *
        FROM games_scores
        WHERE game = ?
        ORDER BY score DESC, created_at ASC
        LIMIT ?
      `).bind(game, limit).all(),
    bestScoreForUser: (db: D1Database, userId: number, game: string) =>
      db.prepare(`
        SELECT score
        FROM games_scores
        WHERE user_id = ? AND game = ?
        ORDER BY score DESC
        LIMIT 1
      `).bind(userId, game).first(),
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
