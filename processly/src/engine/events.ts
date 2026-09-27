import type { Queryable } from '../db.js';
import { tx } from '../db.js';
import { truthy } from '../expr.js';
import type { Trigger, Workflow } from '../workflow.js';
import { createRun, queueRun, resolveWait, WaitRow } from './store.js';
import type { Services } from './types.js';

export type Channel = 'whatsapp' | 'email' | 'api' | 'form' | 'file' | 'db' | 'schedule';

const TRIGGER_FOR: Record<Channel, string> = {
  whatsapp: 'trigger.whatsapp', email: 'trigger.email', api: 'trigger.api', form: 'trigger.form',
  file: 'trigger.file', db: 'trigger.db_event', schedule: 'trigger.schedule',
};

export interface InboundEvent {
  channel: Channel;
  /** Keys a waiting run can match on: sender phone, email address, message ids, upload ref... */
  correlation: string[];
  /** De-duplicates redelivered webhooks (e.g. the provider's message id). */
  idemKey?: string;
  payload: Record<string, unknown>;
  /** Restrict new runs to one workflow (per-workflow webhook URLs). */
  workflow?: string;
}

export interface Delivery { eventId: string | null; duplicate: boolean; resumed: string | null; started: string[] }

/** Does this trigger want this event? Channel-specific filters, then `when`. */
async function triggerMatches(t: Trigger, e: InboundEvent): Promise<boolean> {
  if (t.use !== TRIGGER_FOR[e.channel]) return false;
  const p = e.payload;
  const lower = (v: unknown) => String(v ?? '').toLowerCase();
  if (t.use === 'trigger.whatsapp') {
    const match = t.match == null ? [] : ([] as string[]).concat(t.match as string | string[]);
    if (match.length && !match.some(m => lower(p.text).includes(m.toLowerCase()))) return false;
    const types = t.types == null ? [] : ([] as string[]).concat(t.types as string | string[]);
    if (types.length && !types.includes(String(p.type))) return false;
  }
  if (t.use === 'trigger.email') {
    if (t.inbox && !(p.to as string[] | undefined)?.some(a => lower(a).includes(lower(t.inbox)))) return false;
    if (t.subject_contains && !lower(p.subject).includes(lower(t.subject_contains))) return false;
  }
  if (t.use === 'trigger.api' && t.event && p.event !== t.event) return false;
  if (t.use === 'trigger.file' && t.folder && p.folder !== t.folder) return false;
  if (t.use === 'trigger.db_event') {
    if (p.table !== t.table) return false;
    const on = (t.on as string | undefined) ?? 'insert_or_update';
    if (on !== 'insert_or_update' && p.op !== on) return false;
  }
  return t.when ? truthy(t.when, { trigger: p }) : true;
}

export async function startRun(q: Queryable, wf: Workflow, triggerId: string | null, payload: unknown) {
  return createRun(q, wf, triggerId, payload);
}

/**
 * Routes an inbound event: if a run is waiting for it (a reply in an ongoing
 * conversation), resume that run; otherwise start every workflow whose
 * trigger matches.
 */
export async function deliverEvent(services: Services, e: InboundEvent): Promise<Delivery> {
  const { db, project } = services;
  const candidates: { wf: Workflow; t: Trigger }[] = [];
  for (const wf of project.workflows.values()) {
    if (e.workflow && wf.workflow !== e.workflow) continue;
    for (const t of wf.triggers) if (await triggerMatches(t, e)) { candidates.push({ wf, t }); break; }
  }

  return tx(db, async c => {
    const ins = await c.query(
      `INSERT INTO events (channel, correlation, idem_key, payload) VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel, idem_key) DO NOTHING RETURNING id`,
      [e.channel, e.correlation, e.idemKey ?? null, JSON.stringify(e.payload)]);
    if (!ins.rows.length) return { eventId: null, duplicate: true, resumed: null, started: [] };
    const eventId: string = ins.rows[0].id;

    if (e.correlation.length && !e.workflow) {
      const { rows } = await c.query(
        `SELECT * FROM run_waits WHERE kind = 'event' AND channel = $1 AND resolved_at IS NULL AND correlation && $2
          ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`, [e.channel, e.correlation]);
      if (rows.length) {
        const w = rows[0] as WaitRow;
        await resolveWait(c, w.id, e.payload);
        await c.query(`UPDATE events SET consumed_by = $2 WHERE id = $1`, [eventId, w.run_id]);
        await queueRun(c, w.run_id);
        return { eventId, duplicate: false, resumed: w.run_id, started: [] };
      }
    }

    const started: string[] = [];
    for (const { wf, t } of candidates) started.push((await startRun(c, wf, t.id, e.payload)).id);
    if (started.length) await c.query(`UPDATE events SET started_runs = $2 WHERE id = $1`, [eventId, started]);
    return { eventId, duplicate: false, resumed: null, started };
  });
}

/** For a wait just created: claim a matching event that arrived moments earlier. */
export async function consumeMatchingEvent(q: Queryable, w: WaitRow, runId: string): Promise<unknown | null> {
  const { rows } = await q.query(
    `UPDATE events SET consumed_by = $4 WHERE id = (
        SELECT id FROM events WHERE channel = $1 AND correlation && $2 AND received_at >= $3 AND consumed_by IS NULL
         ORDER BY received_at LIMIT 1 FOR UPDATE SKIP LOCKED)
     RETURNING payload`, [w.channel, w.correlation, w.since, runId]);
  if (!rows.length) return null;
  await resolveWait(q, w.id, rows[0].payload);
  return rows[0].payload;
}
