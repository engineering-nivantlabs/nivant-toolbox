import type { Db, Queryable } from '../db.js';
import type { Workflow } from '../workflow.js';

export interface RunRow {
  id: string; workflow: string; version: number; mode: 'auto' | 'review'; definition: Workflow;
  trigger_id: string | null; trigger: Record<string, unknown>; status: string;
  wake_at: Date | null; error: string | null; stop_reason: string | null; created_at: Date; finished_at: Date | null;
}
export interface StepRow {
  seq: string; run_id: string; key: string; step_id: string | null; primitive: string;
  status: 'started' | 'completed' | 'failed' | 'skipped'; attempts: number;
  input: unknown; output: unknown; error: string | null; started_at: Date; finished_at: Date | null;
}
export interface WaitRow {
  id: string; run_id: string; key: string; kind: 'timer' | 'event' | 'approval'; channel: string | null;
  correlation: string[] | null; since: Date; wake_at: Date | null; resolved_at: Date | null; payload: unknown;
}
export interface ApprovalRow {
  id: string; run_id: string; step_key: string; kind: 'gate' | 'review'; title: string; detail: unknown;
  approver: string | null; status: 'pending' | 'approved' | 'rejected' | 'expired';
  decided_by: string | null; note: string | null; edits: Record<string, unknown> | null; expires_at: Date | null;
  created_at: Date; decided_at: Date | null;
}

export async function createRun(q: Queryable, wf: Workflow, triggerId: string | null, trigger: unknown): Promise<RunRow> {
  const { rows } = await q.query(
    `INSERT INTO runs (workflow, version, mode, definition, trigger_id, trigger) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [wf.workflow, wf.version, wf.mode, JSON.stringify(wf), triggerId, JSON.stringify(trigger ?? {})]);
  return rows[0];
}

/** Claims one runnable run: queued, due, or abandoned by a crashed worker. */
export async function claimRun(db: Db, worker: string, lockMs: number): Promise<RunRow | null> {
  const { rows } = await db.query(
    `UPDATE runs SET status = 'running', locked_by = $1, locked_until = now() + ($2 || ' milliseconds')::interval, updated_at = now()
      WHERE id = (
        SELECT id FROM runs
         WHERE status = 'queued'
            OR (status = 'waiting' AND wake_at <= now())
            OR (status = 'running' AND locked_until < now())
         ORDER BY coalesce(wake_at, created_at)
         FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`, [worker, String(lockMs)]);
  return rows[0] ?? null;
}

export async function extendLock(db: Db, runId: string, worker: string, lockMs: number) {
  await db.query(`UPDATE runs SET locked_until = now() + ($3 || ' milliseconds')::interval WHERE id = $1 AND locked_by = $2`, [runId, worker, String(lockMs)]);
}

export async function finishRun(db: Db, runId: string, worker: string, patch: { status: string; wake_at?: Date | null; error?: string | null; stop_reason?: string | null }) {
  const terminal = ['completed', 'stopped', 'failed', 'cancelled'].includes(patch.status);
  // A wait may have been resolved (event/approval) while this worker was busy:
  // in that case go straight back to queued instead of sleeping.
  await db.query(
    `UPDATE runs SET
        status = CASE WHEN $2 = 'waiting' AND EXISTS (
                   SELECT 1 FROM run_waits w WHERE w.run_id = runs.id AND w.resolved_at IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1 FROM run_steps s WHERE s.run_id = w.run_id AND s.key = w.key AND s.status = 'completed'))
                 THEN 'queued' ELSE $2 END,
        wake_at = $3, error = $4, stop_reason = $5, locked_by = NULL, locked_until = NULL,
        finished_at = CASE WHEN $6 THEN now() ELSE NULL END, updated_at = now()
      WHERE id = $1 AND locked_by = $7`,
    [runId, patch.status, patch.wake_at ?? null, patch.error ?? null, patch.stop_reason ?? null, terminal, worker]);
}

export async function loadSteps(q: Queryable, runId: string): Promise<StepRow[]> {
  return (await q.query(`SELECT * FROM run_steps WHERE run_id = $1 ORDER BY seq`, [runId])).rows;
}

export async function loadWaits(q: Queryable, runId: string): Promise<WaitRow[]> {
  return (await q.query(`SELECT * FROM run_waits WHERE run_id = $1`, [runId])).rows;
}

export async function saveStep(q: Queryable, runId: string, s: Pick<StepRow, 'key' | 'step_id' | 'primitive' | 'status'> & Partial<Pick<StepRow, 'attempts' | 'input' | 'output' | 'error'>>): Promise<StepRow> {
  const done = s.status !== 'started';
  const { rows } = await q.query(
    `INSERT INTO run_steps (run_id, key, step_id, primitive, status, attempts, input, output, error, finished_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10 THEN now() END)
     ON CONFLICT (run_id, key) DO UPDATE SET
          status = EXCLUDED.status, attempts = EXCLUDED.attempts, input = coalesce(EXCLUDED.input, run_steps.input),
          output = EXCLUDED.output, error = EXCLUDED.error, finished_at = EXCLUDED.finished_at
     RETURNING *`,
    [runId, s.key, s.step_id, s.primitive, s.status, s.attempts ?? 1,
      s.input === undefined ? null : JSON.stringify(s.input), s.output === undefined ? null : JSON.stringify(s.output), s.error ?? null, done]);
  return rows[0];
}

export async function insertWait(q: Queryable, w: Pick<WaitRow, 'run_id' | 'key' | 'kind'> & Partial<Pick<WaitRow, 'channel' | 'correlation' | 'since' | 'wake_at' | 'resolved_at' | 'payload'>>): Promise<WaitRow> {
  const { rows } = await q.query(
    `INSERT INTO run_waits (run_id, key, kind, channel, correlation, since, wake_at, resolved_at, payload)
          VALUES ($1, $2, $3, $4, $5, coalesce($6, now()), $7, $8, $9)
     ON CONFLICT (run_id, key) DO UPDATE SET run_id = EXCLUDED.run_id RETURNING *`,
    [w.run_id, w.key, w.kind, w.channel ?? null, w.correlation ?? null, w.since ?? null, w.wake_at ?? null, w.resolved_at ?? null,
      w.payload === undefined ? null : JSON.stringify(w.payload)]);
  return rows[0];
}

export async function resolveWait(q: Queryable, waitId: string, payload: unknown) {
  await q.query(`UPDATE run_waits SET resolved_at = now(), payload = $2 WHERE id = $1 AND resolved_at IS NULL`, [waitId, JSON.stringify(payload ?? null)]);
}

/** Wakes a suspended run right away (event arrived, approval decided). */
export async function queueRun(q: Queryable, runId: string) {
  await q.query(`UPDATE runs SET status = 'queued', wake_at = NULL, updated_at = now() WHERE id = $1 AND status = 'waiting'`, [runId]);
}
