-- Quiz tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/005_quiz.sql

CREATE TABLE IF NOT EXISTS quiz_quizzes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id      INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    source_url      TEXT,                        -- For Quizify-generated quizzes
    is_public       INTEGER DEFAULT 1,           -- boolean
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_quiz_quizzes_creator ON quiz_quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_quiz_quizzes_public ON quiz_quizzes(is_public, created_at);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id         INTEGER NOT NULL REFERENCES quiz_quizzes(id) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    options         TEXT NOT NULL,               -- JSON array of option strings
    correct_index   INTEGER NOT NULL,            -- 0-based index of correct answer
    explanation     TEXT,                        -- Optional explanation
    order_index     INTEGER DEFAULT 0            -- Display order
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id         INTEGER NOT NULL REFERENCES quiz_quizzes(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL,            -- Percentage * 100 (e.g., 8500 = 85%)
    answers         TEXT NOT NULL,               -- JSON array of selected indices
    started_at      INTEGER DEFAULT (unixepoch()),
    completed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_score ON quiz_attempts(score DESC);