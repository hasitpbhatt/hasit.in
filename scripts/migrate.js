#!/usr/bin/env node
// Migration runner for D1 database

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const REMOTE_FLAG = process.argv.includes('--remote');

function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function runMigration(file, remote = false) {
  const args = ['d1', 'execute', 'hasit-in', '--file', path.join(MIGRATIONS_DIR, file)];
  if (remote) args.push('--remote');
  
  console.log(`\n📦 Running migration: ${file}`);
  const result = spawnSync('wrangler', args, { 
    stdio: 'inherit',
    shell: true,
  });
  
  if (result.error) {
    console.error(`❌ Failed to run migration ${file}:`, result.error.message);
    return false;
  }
  
  if (result.status !== 0) {
    console.error(`❌ Migration ${file} failed with exit code ${result.status}`);
    return false;
  }
  
  console.log(`✅ Migration ${file} completed`);
  return true;
}

async function main() {
  const files = getMigrationFiles();
  
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }
  
  console.log(`Found ${files.length} migration(s):`);
  files.forEach(f => console.log(`  - ${f}`));
  
  if (REMOTE_FLAG) {
    console.log('\n⚠️  Running against REMOTE database');
  } else {
    console.log('\n🔧 Running against LOCAL database');
  }
  
  let success = true;
  for (const file of files) {
    if (!runMigration(file, REMOTE_FLAG)) {
      success = false;
      break;
    }
  }
  
  if (success) {
    console.log('\n🎉 All migrations completed successfully!');
  } else {
    console.log('\n💥 Migration failed!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});