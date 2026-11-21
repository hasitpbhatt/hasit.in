-- Games tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/007_games.sql

CREATE TABLE IF NOT EXISTS games_scores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    game            TEXT NOT NULL,               -- 'snake', '2048', 'memory', 'tetris', etc.
    score           INTEGER NOT NULL,
    metadata        TEXT,                        -- JSON: level, time, moves, etc.
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_games_scores_user ON games_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_games_scores_game ON games_scores(game);
CREATE INDEX IF NOT EXISTS idx_games_scores_score ON games_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_games_scores_game_score ON games_scores(game, score DESC);