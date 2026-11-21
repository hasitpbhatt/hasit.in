-- Daily claim streaks (retention). Separate table so no ALTER TABLE is needed
-- on the legacy production trx_addresses table — migrations re-run every deploy.

CREATE TABLE IF NOT EXISTS trx_streaks (
    address         TEXT PRIMARY KEY,
    streak          INTEGER NOT NULL DEFAULT 0,
    last_claim_day  INTEGER NOT NULL DEFAULT 0  -- floor(unix_ms / 86400000)
);
