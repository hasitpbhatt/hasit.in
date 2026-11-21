-- TRX Faucet tables
-- Safe to run on the existing remote database: every statement is idempotent.
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/010_trx_faucet.sql

CREATE TABLE IF NOT EXISTS trx_settings (
    name            TEXT PRIMARY KEY,
    value           TEXT
);

CREATE TABLE IF NOT EXISTS trx_claimlog (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    address         TEXT NOT NULL,
    ip              TEXT NOT NULL,
    time            INTEGER NOT NULL,
    reward          INTEGER NOT NULL,              -- in sun (1 TRX = 1,000,000 sun)
    shortlink       TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_trx_claimlog_address ON trx_claimlog(address);
CREATE INDEX IF NOT EXISTS idx_trx_claimlog_ip ON trx_claimlog(ip);
CREATE INDEX IF NOT EXISTS idx_trx_claimlog_time ON trx_claimlog(time);

CREATE TABLE IF NOT EXISTS trx_ips (
    ip              TEXT PRIMARY KEY,
    last_used       INTEGER NOT NULL DEFAULT 0    -- -1 marks a banned IP
);

CREATE TABLE IF NOT EXISTS trx_refs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    address         TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS trx_addresses (
    address         TEXT PRIMARY KEY,
    last_used       INTEGER NOT NULL DEFAULT 0,
    ref_id          INTEGER REFERENCES trx_refs(id)
);

CREATE TABLE IF NOT EXISTS trx_pages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    url_name        TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    html            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trx_locks (
    kind            TEXT NOT NULL,                -- 'ip' | 'address'
    key             TEXT NOT NULL,
    expires_at      INTEGER NOT NULL,
    PRIMARY KEY (kind, key)
);

CREATE TABLE IF NOT EXISTS trx_ProxyCheck (
    ip              TEXT PRIMARY KEY,
    time            INTEGER NOT NULL,
    data            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trx_NH_Log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    time            INTEGER NOT NULL,
    ip              TEXT NOT NULL,
    suggestion      TEXT,
    reason          TEXT
);

-- Seed defaults (INSERT OR IGNORE keeps existing production values)
INSERT OR IGNORE INTO trx_settings (name, value) VALUES
    ('timer', '5'),
    ('rewards', '3019-90559*98.95, 90559-150932*1, 3018631*0.05'),
    ('referral', '50'),
    ('limit_number_of_claims_per_24h', '3'),
    ('ref_users', '0'),
    ('balance', '0');

INSERT OR IGNORE INTO trx_pages (url_name, name, html) VALUES
    ('faq', 'FAQ', '<h2>FAQ</h2><p>Claim free TRX every few minutes and withdraw to FaucetPay.</p>');
