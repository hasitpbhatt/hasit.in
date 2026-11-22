CREATE TABLE IF NOT EXISTS freellm_runtime_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_freellm_runtime_state_expiry
  ON freellm_runtime_state(expires_at_ms)
  WHERE expires_at_ms IS NOT NULL;
