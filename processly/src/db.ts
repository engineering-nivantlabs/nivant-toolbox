import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// DATE columns stay 'YYYY-MM-DD' strings (not midnight in the server's timezone).
pg.types.setTypeParser(1082, v => v);

export type Db = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

export function createPool(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on('error', err => console.error('[db] idle client error', err));
  return pool;
}

export async function tx<T>(db: Db, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** Applies migrations/*.sql in order, once each. Safe to run on every start. */
export async function migrate(db: Db): Promise<string[]> {
  return tx(db, async c => {
    await c.query('SELECT pg_advisory_xact_lock(727274)');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map(r => r.name));
    const applied: string[] = [];
    for (const f of fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) {
      if (done.has(f)) continue;
      await c.query(fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
      await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      applied.push(f);
    }
    return applied;
  });
}
