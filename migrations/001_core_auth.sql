-- Core authentication tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/001_core_auth.sql

CREATE TABLE IF NOT EXISTS core_users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sub             TEXT UNIQUE NOT NULL,        -- Google sub
    email           TEXT NOT NULL,
    name            TEXT,
    picture         TEXT,
    created_at      INTEGER DEFAULT (unixepoch()),
    updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_core_users_sub ON core_users(sub);
CREATE INDEX IF NOT EXISTS idx_core_users_email ON core_users(email);

CREATE TABLE IF NOT EXISTS core_user_apps (
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    app             TEXT NOT NULL,               -- 'freellm', 'fitness', 'finance', 'quiz', 'blog', 'games', 'trx'
    refresh_token   TEXT NOT NULL,               -- Encrypted at rest
    scope           TEXT NOT NULL,               -- OAuth scopes granted
    connected_at    INTEGER DEFAULT (unixepoch()),
    revoked_at      INTEGER,
    PRIMARY KEY (user_id, app)
);

CREATE INDEX IF NOT EXISTS idx_core_user_apps_user ON core_user_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_core_user_apps_app ON core_user_apps(app);

CREATE TABLE IF NOT EXISTS core_sessions (
    id              TEXT PRIMARY KEY,            -- JWT jti
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    app             TEXT NOT NULL,
    issued_at       INTEGER DEFAULT (unixepoch()),
    expires_at      INTEGER NOT NULL,
    revoked_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_core_sessions_user ON core_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_core_sessions_expires ON core_sessions(expires_at);