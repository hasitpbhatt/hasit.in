-- FreeLLM tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/002_freellm.sql

CREATE TABLE IF NOT EXISTS freellm_validations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,               -- 'openai', 'anthropic', 'gemini', 'groq', etc.
    model           TEXT,                        -- Model name tested
    success         INTEGER NOT NULL DEFAULT 0,  -- boolean
    latency_ms      INTEGER,                     -- Response latency
    error           TEXT,                        -- Error message if failed
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_freellm_validations_user ON freellm_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_freellm_validations_provider ON freellm_validations(provider);
CREATE INDEX IF NOT EXISTS idx_freellm_validations_created ON freellm_validations(created_at);

CREATE TABLE IF NOT EXISTS freellm_api_keys (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,               -- 'openai', 'anthropic', 'gemini', etc.
    key_hash        TEXT NOT NULL,               -- SHA256(key) for deduplication
    key_encrypted   TEXT NOT NULL,               -- Encrypted API key
    label           TEXT,                        -- User-defined label
    last_validated  INTEGER,                     -- Last validation timestamp
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_freellm_api_keys_user ON freellm_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_freellm_api_keys_provider ON freellm_api_keys(provider);
-- idx_freellm_api_keys_hash omitted: the pre-existing production table has no
-- key_hash column (old Pages schema). Add manually if the table is rebuilt.