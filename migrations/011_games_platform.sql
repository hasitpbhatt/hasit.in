-- Unified games app schema. The original Pages schema used generic table names;
-- this Worker maps those names to the games_ namespace at the D1 boundary.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS games_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  faucetpay_username TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  kdf_iterations INTEGER NOT NULL DEFAULT 100000,
  last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games_score_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  score INTEGER NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  highest_tile INTEGER
);
CREATE INDEX IF NOT EXISTS idx_games_score_events_user_date
  ON games_score_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_games_score_events_date
  ON games_score_events(created_at);

CREATE TABLE IF NOT EXISTS games_daily_budget (
  date TEXT PRIMARY KEY,
  points_issued INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS games_payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  payout_amount INTEGER NOT NULL,
  points_cost INTEGER NOT NULL,
  payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  faucetpay_username TEXT
);
CREATE INDEX IF NOT EXISTS idx_games_payouts_user ON games_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_games_payouts_ip_date ON games_payouts(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_games_payouts_wallet_date
  ON games_payouts(faucetpay_username, created_at);

CREATE TABLE IF NOT EXISTS games_promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games_code_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (code, user_id)
);
CREATE INDEX IF NOT EXISTS idx_games_code_redemptions_user
  ON games_code_redemptions(user_id);

CREATE TABLE IF NOT EXISTS games_user_daily (
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  points_issued INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS games_rate_limits (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, bucket)
);

CREATE TABLE IF NOT EXISTS games_play_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_games_play_sessions_user
  ON games_play_sessions(user_id);

CREATE TABLE IF NOT EXISTS games_ip_daily (
  ip TEXT NOT NULL,
  date TEXT NOT NULL,
  points_issued INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, date)
);

CREATE TABLE IF NOT EXISTS games_user_rewards (
  user_id INTEGER NOT NULL REFERENCES games_users(id) ON DELETE CASCADE,
  reward TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, reward)
);
