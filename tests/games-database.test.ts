import { test } from 'node:test';
import assert from 'node:assert/strict';

import { prefixGamesSql } from '../src/lib/db/games-database.ts';

test('game D1 queries use the games_ namespace without rewriting columns', () => {
  const sql =
    'SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?1';
  assert.equal(
    prefixGamesSql(sql),
    'SELECT games_users.* FROM games_sessions JOIN games_users ON games_users.id = games_sessions.user_id WHERE games_sessions.token = ?1'
  );
});

test('game table names are namespaced in every supported SQL clause', () => {
  assert.equal(
    prefixGamesSql(
      'INSERT INTO score_events (user_id) VALUES (?1); UPDATE users SET balance = ?1; DELETE FROM sessions WHERE token = ?2'
    ),
    'INSERT INTO games_score_events (user_id) VALUES (?1); UPDATE games_users SET balance = ?1; DELETE FROM games_sessions WHERE token = ?2'
  );
});
