const GAME_TABLES = [
  'code_redemptions',
  'daily_budget',
  'ip_daily',
  'play_sessions',
  'promo_codes',
  'rate_limits',
  'score_events',
  'sessions',
  'user_daily',
  'user_rewards',
  'users',
  'payouts',
] as const;

const GAME_TABLE_PATTERN = new RegExp(`\\b(${GAME_TABLES.join('|')})\\b`, 'g');

export function prefixGamesSql(sql: string): string {
  return sql.replace(GAME_TABLE_PATTERN, 'games_$1');
}

export function createGamesDatabase(db: D1Database): D1Database {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') {
        return (sql: string) => target.prepare(prefixGamesSql(sql));
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
