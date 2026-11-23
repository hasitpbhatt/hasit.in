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

const GAME_TABLE_SET = new Set<string>(GAME_TABLES);

const CLAUSE_ENDERS = new Set([
  'where',
  'set',
  'group',
  'order',
  'limit',
  'having',
  'on',
  'values',
  'union',
  'intersect',
  'except',
  'returning',
]);

export function prefixGamesSql(sql: string): string {
  // Tokenise so we can tell table references apart from columns, aliases and
  // identifiers that merely contain a table name as a substring.
  const tokens = sql.match(/[A-Za-z_][A-Za-z0-9_]*|[(),;]|\s+|./g) || [];
  const out: string[] = [];

  let inTableList = false;
  let expectTable = false;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    if (/^\s+$/.test(tok)) {
      out.push(tok);
      continue;
    }

    if (tok === ',') {
      out.push(tok);
      if (inTableList) expectTable = true;
      continue;
    }

    if (tok === '(' || tok === ')' || tok === ';') {
      out.push(tok);
      if (tok !== '(') {
        inTableList = false;
        expectTable = false;
      }
      continue;
    }

    if (!/^[A-Za-z_]/.test(tok)) {
      out.push(tok);
      continue;
    }

    // Keyword handling.
    if (lower === 'delete') {
      out.push(tok);
      continue;
    }
    if (lower === 'from') {
      inTableList = true;
      expectTable = true;
      out.push(tok);
      continue;
    }
    if (lower === 'join') {
      inTableList = true;
      expectTable = true;
      out.push(tok);
      continue;
    }
    if (lower === 'into') {
      inTableList = true;
      expectTable = true;
      out.push(tok);
      continue;
    }
    if (lower === 'update') {
      inTableList = false;
      expectTable = true;
      out.push(tok);
      continue;
    }
    if (lower === 'table') {
      inTableList = true;
      expectTable = true;
      out.push(tok);
      continue;
    }
    if (CLAUSE_ENDERS.has(lower)) {
      inTableList = false;
      expectTable = false;
      out.push(tok);
      continue;
    }

    // Identifier handling.
    const isGameTable = GAME_TABLE_SET.has(lower);
    const nextIsDot = tokens[i + 1] === '.';

    if (isGameTable && (expectTable || nextIsDot)) {
      out.push('games_' + tok);
    } else {
      out.push(tok);
    }

    // A table reference may be followed by an alias; don't prefix the alias.
    expectTable = false;
  }

  return out.join('');
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
