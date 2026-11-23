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

test('table names in JOIN and comma-separated FROM lists are namespaced', () => {
  assert.equal(
    prefixGamesSql('SELECT * FROM users, sessions WHERE users.id = sessions.user_id'),
    'SELECT * FROM games_users, games_sessions WHERE games_users.id = games_sessions.user_id'
  );
});

test('column names that merely contain a table name are not rewritten', () => {
  assert.equal(
    prefixGamesSql('SELECT user_id, session_token FROM users'),
    'SELECT user_id, session_token FROM games_users'
  );
});

test('standalone identifiers unrelated to game tables are untouched', () => {
  assert.equal(prefixGamesSql('SELECT id, name FROM accounts'), 'SELECT id, name FROM accounts');
});
