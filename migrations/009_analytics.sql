-- Analytics tables (cross-project)
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/009_analytics.sql

CREATE TABLE IF NOT EXISTS analytics_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES core_users(id) ON DELETE SET NULL,
    app             TEXT NOT NULL,               -- 'trx', 'freellm', 'fitness', 'finance', 'blog', 'quiz', 'games', 'portfolio'
    event           TEXT NOT NULL,               -- 'claim', 'validation', 'workout_logged', 'trade', 'post_view', 'quiz_complete', 'game_play', 'deal_click'
    properties      TEXT,                        -- JSON: event-specific properties
    session_id      TEXT,                        -- Session identifier
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_app ON analytics_events(app);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_app_event ON analytics_events(app, event);