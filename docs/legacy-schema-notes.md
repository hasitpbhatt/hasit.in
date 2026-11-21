# Legacy Schema Notes

Production D1 (`hasit-in`, id `ea3f54ed-75e6-4a45-b7b9-d80509efe4e8`) was created by the
old Pages apps. The unified Worker reuses the **same database**, so old tables and indexes
still exist alongside the new ones.

**Status: old tables are intentionally kept for now.** Nothing below is broken today —
this is a cleanup checklist for later.

## How to read this

| Kind | Meaning |
|------|---------|
| **KEPT-LEGACY** | Old Pages table/index. Not referenced by the Worker. Safe to drop once the old Pages apps are retired. |
| **SCHEMA-DRIFT** | Table exists in both worlds but the old Pages schema won. The Worker uses the old columns. Indexes that the new migrations wanted were omitted. |

## 1. Schema drift — two indexes were omitted from migrations

These indexes are defined in the migration files but **commented out** because the
pre-existing production tables have a different shape. `CREATE TABLE IF NOT EXISTS` was
a no-op for them, so the old schema survived.

### `migrations/002_freellm.sql`

```sql
-- OMITTED:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_freellm_api_keys_hash ON freellm_api_keys(key_hash);
```

Production `freellm_api_keys` has no `key_hash` column. It uses
`key_ciphertext` / `key_iv` / `auth_kind` / `protocol` / `refresh_ciphertext` etc.
(26 columns, from the old Pages FreeLLM app).

Migration's intended columns: `key_hash`, `key_encrypted`, `label`, `last_validated`.

### `migrations/003_fitness.sql`

```sql
-- OMITTED:
-- CREATE INDEX IF NOT EXISTS idx_fitness_goals_period ON fitness_goals(period_start, period_end);
```

Production `fitness_goals` columns: `id, user_id, type, target, current, period, updated_at, created_at`.
Migration's intended columns: `metric`, `target`, `period_start`, `period_end`.

### To resolve later

Either rebuild the table with the new schema (migrate data, drop, recreate) or add the
missing columns with `ALTER TABLE`. Then re-enable the two indexes above.

## 2. Legacy indexes on tables the Worker still uses

These live on tables that exist in the new schema. They are harmless but redundant.
Drop them when convenient:

```sql
-- freellm_api_keys (old Pages indexes; new migration adds _user and _provider)
DROP INDEX IF EXISTS idx_freellm_api_keys_pool;         -- (contributed, provider)
DROP INDEX IF EXISTS idx_freellm_api_keys_user_kind;     -- (user_id, auth_kind)
DROP INDEX IF EXISTS idx_freellm_api_keys_user_protocol; -- (user_id, protocol)

-- trx_claimlog (old Pages composite indexes; new migration adds single-column ones)
DROP INDEX IF EXISTS idx_trx_claimlog_addr_ip_time;  -- (address, ip, time)
DROP INDEX IF EXISTS idx_trx_claimlog_ip_time;       -- (ip, time)

-- trx_addresses
DROP INDEX IF EXISTS idx_trx_addresses_ref_id;      -- (ref_id)
```

Note: `idx_trx_claimlog_addr_ip_time` and `idx_trx_claimlog_ip_time` are actually
*useful* for the Worker — the claim queries filter on address+ip+time. Keep them unless
you add equivalent composite indexes.

## 3. Legacy tables — full drop list

No table in this list is created or referenced by any file under `migrations/` or
`src/lib/db/queries.ts`. They belong to the old Pages apps.

### FreeLLM (old Pages app)

```
freellm_admin_audit_log        freellm_admin_grants
freellm_api_tokens             freellm_arcade_levels
freellm_auth_identities        freellm_battles
freellm_battle_votes           freellm_checkins
freellm_connections            freellm_credit_holds
freellm_credit_ledger          freellm_email_blocks
freellm_email_verifications    freellm_game_rounds
freellm_key_health_events      freellm_leaderboard_memory
freellm_leaderboard_meta       freellm_leaderboard_referrals
freellm_leaderboard_streak     freellm_leaderboard_typing
freellm_model_credit_grants    freellm_model_providers
freellm_model_providers_0025_backup
freellm_models                 freellm_promo_codes
freellm_promo_redemptions      freellm_proxies
freellm_referral_milestones    freellm_referrals
freellm_seasonal_cosmetics     freellm_seasonal_events
freellm_streak_freezes         freellm_task_completions
freellm_tasks                  freellm_upstream_keys
freellm_upstream_models        freellm_upstream_models_0025_backup
freellm_upstream_providers     freellm_upstream_providers_0025_backup
freellm_usage_events           freellm_user_badges
freellm_user_cosmetics         freellm_user_seasonal_events
freellm_user_visits            freellm_users
freellm_weekly_quest_progress  freellm_weekly_quests
```

### Fitness (old Pages app)

```
daily_checkins                 daily_streaks
fitness_badges                 fitness_body_profile
fitness_coach_usage            fitness_entitlements
fitness_events                 fitness_foods
fitness_habits                 fitness_logs
fitness_measurements           fitness_notifications
fitness_notification_views     fitness_preference_updates
fitness_preferences            fitness_profiles
fitness_rate_limits            fitness_scan_ledger
fitness_scan_usage             user_badges
```

### Old Pages app tables that DO have a new-schema counterpart

These need care — same name, different shape. Do not drop without checking:

| Table | Note |
|-------|------|
| `freellm_api_keys` | SCHEMA-DRIFT (see §1) |
| `fitness_goals` | SCHEMA-DRIFT (see §1) |
| `freellm_validations` | Matches new schema — safe |
| `core_users`, `core_user_apps`, `core_sessions` | Matches new schema — safe |
| `trx_*` (7 tables) | Matches new schema — safe, used by the faucet |

## 4. Drop order

Foreign keys reference parents, so drop children first:

```sql
PRAGMA foreign_keys = OFF;

-- FreeLLM children before parents
DROP TABLE IF EXISTS freellm_task_completions;
DROP TABLE IF EXISTS freellm_usage_events;
-- ... (full list in §3)

DROP TABLE IF EXISTS freellm_users;   -- parent of nearly all freellm_* tables
DROP TABLE IF EXISTS core_users;      -- last: parents of freellm_*/fitness_*

PRAGMA foreign_keys = ON;
```

Always **export a D1 backup first**:

```bash
npx wrangler d1 export hasit-in --remote --output backup.sql
```

## 5. Related stale table

`trx_ProxyCheck` and `trx_NH_Log` still exist from the old app. The ProxyCheck / IPHub
providers were removed, so any rows in `trx_ProxyCheck` are dead deny-list entries that
can block an IP for up to 7 days. Clear them once:

```sql
DELETE FROM trx_ProxyCheck;
```

Keep the tables — the code still references them.
