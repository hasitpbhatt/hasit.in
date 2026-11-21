-- Finance tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/004_finance.sql

CREATE TABLE IF NOT EXISTS finance_portfolios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    base_currency   TEXT DEFAULT 'USD',
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_finance_portfolios_user ON finance_portfolios(user_id);

CREATE TABLE IF NOT EXISTS finance_holdings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id    INTEGER NOT NULL REFERENCES finance_portfolios(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    quantity        REAL NOT NULL,
    avg_cost        REAL,                        -- Average cost basis per unit
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_finance_holdings_portfolio ON finance_holdings(portfolio_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_holdings_symbol ON finance_holdings(portfolio_id, symbol);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id    INTEGER NOT NULL REFERENCES finance_portfolios(id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    type            TEXT NOT NULL,               -- 'buy', 'sell', 'dividend', 'split', 'transfer_in', 'transfer_out'
    quantity        REAL NOT NULL,
    price           REAL NOT NULL,               -- Price per unit
    fees            REAL DEFAULT 0,              -- Transaction fees
    executed_at     INTEGER NOT NULL,            -- Execution timestamp
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_portfolio ON finance_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_symbol ON finance_transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_executed ON finance_transactions(executed_at);