-- Fitness tables
-- Run: wrangler d1 execute hasit-in --remote --file=./migrations/003_fitness.sql

CREATE TABLE IF NOT EXISTS fitness_workouts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,               -- 'strava', 'garmin', 'manual', 'health', 'apple'
    source_id       TEXT,                        -- External ID from source
    type            TEXT NOT NULL,               -- 'run', 'ride', 'swim', 'walk', 'hike', 'strength', 'yoga', 'other'
    started_at      INTEGER NOT NULL,            -- Unix timestamp
    duration_sec    INTEGER NOT NULL,            -- Duration in seconds
    distance_m      REAL,                        -- Distance in meters
    calories        INTEGER,                     -- Calories burned
    hr_avg          INTEGER,                     -- Average heart rate
    hr_max          INTEGER,                     -- Max heart rate
    elevation_m     REAL,                        -- Elevation gain in meters
    raw_json        TEXT,                        -- Full source payload for reprocessing
    created_at      INTEGER DEFAULT (unixepoch()),
    updated_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fitness_workouts_user ON fitness_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_workouts_started ON fitness_workouts(started_at);
CREATE INDEX IF NOT EXISTS idx_fitness_workouts_type ON fitness_workouts(type);
CREATE INDEX IF NOT EXISTS idx_fitness_workouts_source ON fitness_workouts(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fitness_workouts_source_id ON fitness_workouts(source, source_id);

CREATE TABLE IF NOT EXISTS fitness_goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
    metric          TEXT NOT NULL,               -- 'weekly_runs', 'weekly_km', 'monthly_km', 'streak_days', 'weekly_minutes'
    target          REAL NOT NULL,               -- Target value
    period_start    INTEGER NOT NULL,            -- Period start timestamp
    period_end      INTEGER NOT NULL,            -- Period end timestamp
    created_at      INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_fitness_goals_user ON fitness_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_goals_period ON fitness_goals(period_start, period_end);

CREATE TABLE IF NOT EXISTS fitness_streaks (
    user_id         INTEGER PRIMARY KEY REFERENCES core_users(id) ON DELETE CASCADE,
    current_streak  INTEGER DEFAULT 0,
    longest_streak  INTEGER DEFAULT 0,
    last_workout_at INTEGER,
    updated_at      INTEGER DEFAULT (unixepoch())
);