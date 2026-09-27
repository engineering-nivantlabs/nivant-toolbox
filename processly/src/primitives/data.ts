import type { Db } from '../db.js';
import { truthy } from '../expr.js';
import { Stop, StepError, type Handler } from '../engine/types.js';

/** Runs SQL against the business database inside a read-only transaction. */
async function readOnly(db: Db, sql: string, params: unknown[]) {
  const c = await db.connect();
  try {
    await c.query('BEGIN READ ONLY');
    await c.query(`SET LOCAL statement_timeout = '15s'`);
    const r = await c.query(sql, params);
    await c.query('COMMIT');
    return JSON.parse(JSON.stringify(r.rows)) as Record<string, unknown>[];
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    const e = err as { code?: string; message: string };
    // 08xxx = connection problems, 57014 = timeout: worth retrying. SQL errors are not.
    throw new StepError(`query failed: ${e.message}`, /^08|^57P0|^53/.test(e.code ?? ''));
  } finally {
    c.release();
  }
}

export const validate: Handler = async (p, sc) => {
  const failures: { name: string; message: string }[] = [];
  for (const r of p.rules as { name: string; check: string; message?: string }[]) {
    if (!(await truthy(r.check, sc.scope))) failures.push({ name: r.name, message: r.message ?? `${r.name} failed` });
  }
  const out = { valid: failures.length === 0, failures };
  if (!out.valid && p.on_fail === 'stop') throw new Stop(`validation failed: ${failures.map(f => f.message).join('; ')}`);
  return out;
};

export const transform: Handler = async p => p.set;

export const dedupe: Handler = async (p, sc) => {
  const parts = (p.keys as unknown[]).filter(k => k != null && String(k).trim() !== '').map(k => String(k).trim().toLowerCase());
  if (!parts.length) return { duplicate: false, key: null, count: 0 };
  const key = parts.join('|');
  const { rows } = await sc.services.db.query(
    `INSERT INTO dedupe_keys (namespace, key, first_run, last_run) VALUES ($1, $2, $3, $3)
     ON CONFLICT (namespace, key) DO UPDATE SET count = dedupe_keys.count + 1, last_run = EXCLUDED.last_run, last_seen = now()
     RETURNING count, first_run, first_seen`, [p.namespace, key, sc.run.id]);
  const r = rows[0];
  return { duplicate: r.count > 1, key, count: r.count, first_run: r.first_run === sc.run.id ? null : r.first_run, first_seen: r.first_seen };
};

export const enrich: Handler = async (p, sc) => {
  const c = sc.services.connectors;
  if (p.sql) {
    const rows = await readOnly(c.dataDb, p.sql, p.params);
    return { rows, row: rows[0] ?? null };
  }
  if (p.records) {
    const { rows } = await sc.services.db.query(`SELECT data FROM records WHERE collection = $1 AND key = $2`, [p.records.collection, p.records.key]);
    return { data: rows[0]?.data ?? null, found: rows.length > 0 };
  }
  const r = await c.http.call(p.connection, { method: p.method, path: p.path ?? '/', query: p.query, body: p.body });
  return { status: r.status, data: r.body };
};

export const store: Handler = async (p, sc) => {
  const files = sc.services.connectors.files;
  if (p.file) {
    const ref = await files.file(p.file.id, p.folder ?? 'inbox', p.name);
    return { file: ref, duplicate: await files.isDuplicate(ref.id) };
  }
  const key = p.key ?? sc.idempotencyKey;
  await sc.services.db.query(
    `INSERT INTO records (collection, key, data, run_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (collection, key) DO UPDATE SET data = EXCLUDED.data, run_id = EXCLUDED.run_id, updated_at = now()`,
    [p.collection, key, JSON.stringify(p.data ?? null), sc.run.id]);
  return { collection: p.collection, key };
};

export const query: Handler = async (p, sc) => {
  let rows: Record<string, unknown>[];
  if (p.sql) rows = await readOnly(sc.services.connectors.dataDb, p.sql, p.params);
  else rows = (await sc.services.db.query(`SELECT key, data FROM records WHERE collection = $1 ORDER BY updated_at DESC LIMIT $2`, [p.records.collection, p.limit])).rows
    .map(r => ({ key: r.key, ...(typeof r.data === 'object' && r.data ? r.data : { value: r.data }) }));
  const truncated = rows.length > p.limit;
  rows = rows.slice(0, p.limit);
  return { rows, count: rows.length, first: rows[0] ?? null, truncated };
};
