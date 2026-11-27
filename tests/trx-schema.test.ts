import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// The trx_* tables in production were created by a legacy service, so the repo
// migrations never actually ran against them. Anything the code writes must
// therefore be limited to columns those migrations declare, otherwise D1 throws
// "no such column" at runtime — which for a faucet means the payout goes out
// and the bookkeeping row is lost.

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

function migrationColumns(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const pattern = /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/g;
    for (const match of sql.matchAll(pattern)) {
      const [, table, body] = match;
      const columns = tables.get(table) ?? new Set<string>();
      for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('--') || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) {
          continue;
        }
        const name = trimmed.match(/^(\w+)/)?.[1];
        if (name) columns.add(name);
      }
      tables.set(table, columns);
    }
  }
  return tables;
}

function columnNames(list: string, fromAlias: string): string[] {
  return list
    .split(',')
    .map((raw) => raw.trim())
    // Aggregates and expressions are not column references to validate.
    .filter((raw) => raw && !raw.includes('('))
    .map((raw) => raw.split(/\s+/).pop() ?? '')
    .filter((qualified) => {
      const [prefix, column] = qualified.includes('.') ? qualified.split('.') : ['', qualified];
      // A column qualified by a joined table's alias belongs to that table, not
      // to the one this FROM clause names.
      if (prefix && prefix.toLowerCase() !== fromAlias.toLowerCase()) return false;
      return /^[A-Za-z_]\w*$/.test(column);
    })
    .map((qualified) => qualified.split('.').pop() ?? '');
}

test('every column written to a trx table exists in the migrations', () => {
  const tables = migrationColumns();
  const source = readFileSync(join(process.cwd(), 'src/lib/db/trx-queries.ts'), 'utf8');

  const problems: string[] = [];
  for (const match of source.matchAll(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(trx_\w+)\s*\(([^)]+)\)/gi)) {
    const [, table, columnList] = match;
    const known = tables.get(table);
    if (!known) {
      problems.push(`trx-queries.ts: no migration defines table ${table}`);
      continue;
    }
    for (const column of columnNames(columnList, table)) {
      if (!known.has(column)) {
        problems.push(`trx-queries.ts: ${table}.${column} is not created by any migration`);
      }
    }
  }

  assert.deepEqual(problems, []);
});

test('every column selected from a trx table exists in the migrations', () => {
  const tables = migrationColumns();
  const source = readFileSync(join(process.cwd(), 'src/lib/db/trx-queries.ts'), 'utf8');

  const problems: string[] = [];
  for (const match of source.matchAll(/SELECT\s+([\s\S]+?)\s+FROM\s+(trx_\w+)(?:\s+(?!WHERE|ORDER|LIMIT|GROUP|LEFT|INNER|JOIN)(\w+))?/gi)) {
    const [, columnList, table, alias] = match;
    const known = tables.get(table);
    if (!known) {
      problems.push(`trx-queries.ts: no migration defines table ${table}`);
      continue;
    }
    if (columnList.trim() === '*') continue;
    for (const column of columnNames(columnList, alias ?? table)) {
      if (!known.has(column)) {
        problems.push(`trx-queries.ts: ${table}.${column} is not created by any migration`);
      }
    }
  }

  assert.deepEqual(problems, []);
});

test('trx_claimlog has no shortlink column because no feature populates one', () => {
  const claimlog = migrationColumns().get('trx_claimlog');
  assert.ok(claimlog, 'migrations should define trx_claimlog');
  assert.equal(claimlog.has('shortlink'), false);

  for (const file of ['src/lib/db/trx-queries.ts', 'src/apps/trx/routes/api.ts', 'src/apps/trx/routes/claim.ts']) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    assert.equal(source.includes('shortlink'), false, `${file} should not reference shortlink`);
  }
});
