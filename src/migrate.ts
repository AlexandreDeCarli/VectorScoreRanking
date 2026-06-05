/**
 * Automatic Database Migration Runner
 * 
 * Runs on every app startup. Tracks applied migrations in a `_migrations` table.
 * Migration files live in `src/migrations/` as numbered .sql files.
 * 
 * Supports dialect-specific migrations:
 *   001_initial.sql          → runs on ALL dialects
 *   002_vectors.mariadb.sql  → runs ONLY on MariaDB
 *   002_vectors.heatwave.sql → runs ONLY on HeatWave
 */

import { pool } from './db';
import { isMariaDB } from './sql-dialect';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dir, 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const [rows]: any = await pool.query('SELECT name FROM _migrations ORDER BY id');
  return new Set(rows.map((r: any) => r.name));
}

function getMigrationDialect(filename: string): 'all' | 'mariadb' | 'heatwave' {
  if (filename.endsWith('.mariadb.sql')) return 'mariadb';
  if (filename.endsWith('.heatwave.sql')) return 'heatwave';
  return 'all';
}

function shouldRun(filename: string): boolean {
  const dialect = getMigrationDialect(filename);
  if (dialect === 'all') return true;
  if (dialect === 'mariadb') return isMariaDB;
  if (dialect === 'heatwave') return !isMariaDB;
  return false;
}

/** Canonical name strips the dialect suffix so MariaDB and HeatWave variants share the same tracking key */
function canonicalName(filename: string): string {
  return filename
    .replace('.mariadb.sql', '.sql')
    .replace('.heatwave.sql', '.sql');
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  let files: string[];
  try {
    files = await readdir(MIGRATIONS_DIR);
  } catch {
    console.log('[migrate] No migrations directory found, skipping.');
    return;
  }

  // Only .sql files, sorted by name (numeric prefix ensures order)
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of sqlFiles) {
    const canonical = canonicalName(file);

    // Already applied?
    if (applied.has(canonical)) continue;

    // Wrong dialect?
    if (!shouldRun(file)) continue;

    // Read and execute
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = await Bun.file(filePath).text();

    console.log(`[migrate] Applying: ${file}`);
    
    // Split by semicolons to support multi-statement migrations
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      await pool.query(stmt);
    }

    // Record as applied
    await pool.query('INSERT INTO _migrations (name) VALUES (?)', [canonical]);
    count++;
  }

  if (count > 0) {
    console.log(`[migrate] ✅ ${count} migration(s) applied.`);
  } else {
    console.log('[migrate] Database is up to date.');
  }
}
