import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Guards against SQL referencing columns that no migration ever creates.
// Production D1 runs the migrations in migrations/, so a column missing from
// that DDL throws "no such column" at runtime and breaks the OAuth callback.

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const SOURCE_DIRS = ['src/lib/auth', 'src/lib/db'];
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

function sourceFiles(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return entry.name.endsWith('.ts') ? [relative] : [];
  });
}

test('every column selected from a core table exists in the migrations', () => {
  const tables = migrationColumns();
  assert.ok(tables.has('core_users'), 'migrations should define core_users');

  const problems: string[] = [];
  for (const file of SOURCE_DIRS.flatMap(sourceFiles)) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    for (const match of source.matchAll(/SELECT\s+([^'"`]+?)\s+FROM\s+(core_\w+)/gi)) {
      const [, columnList, table] = match;
      const known = tables.get(table);
      if (!known) {
        problems.push(`${file}: no migration defines table ${table}`);
        continue;
      }
      for (const raw of columnList.split(',')) {
        const column = raw.trim().split(/\s+/).pop() ?? '';
        if (!column || column === '*' || column.includes('(')) continue;
        if (!known.has(column)) {
          problems.push(`${file}: ${table}.${column} is not created by any migration`);
        }
      }
    }
  }

  assert.deepEqual(problems, []);
});

test('the OAuth callback only reads columns the auth migration creates', () => {
  const users = migrationColumns().get('core_users');
  assert.ok(users);
  assert.ok(users.has('sub') && users.has('email') && users.has('name') && users.has('picture'));
  // Accounts are only created through Google OAuth, which verifies the address,
  // so there is no per-user verification flag to persist.
  assert.equal(users.has('email_verified'), false);
});
