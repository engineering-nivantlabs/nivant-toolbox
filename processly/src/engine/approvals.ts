import crypto from 'node:crypto';
import { tx } from '../db.js';
import type { Db } from '../db.js';
import { ApprovalRow, queueRun, resolveWait, RunRow } from './store.js';
import type { Services } from './types.js';

export function approvalToken(secret: string, id: string) {
  return crypto.createHmac('sha256', secret).update(`approval:${id}`).digest('base64url');
}

export function verifyApprovalToken(secret: string, id: string, token: string) {
  const want = Buffer.from(approvalToken(secret, id));
  const got = Buffer.from(String(token));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function approvalLink(services: Services, id: string) {
  return `${services.config.PUBLIC_URL.replace(/\/$/, '')}/approvals/${id}?t=${approvalToken(services.config.HOOK_SECRET, id)}`;
}

export async function createApproval(
  services: Services, run: RunRow, key: string,
  a: { kind: 'gate' | 'review'; title: string; detail: unknown; approver: string; expiresAt: Date | null; onTimeout: 'approve' | 'reject' },
): Promise<ApprovalRow> {
  const { rows } = await services.db.query(
    `INSERT INTO approvals (run_id, step_key, kind, title, detail, approver, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (run_id, step_key) DO UPDATE SET run_id = EXCLUDED.run_id RETURNING *`,
    [run.id, key, a.kind, a.title, JSON.stringify(a.detail ?? {}), a.approver, a.expiresAt]);
  const approval: ApprovalRow = rows[0];
  const text = `Approval needed: ${a.title}\n${approvalLink(services, approval.id)}` +
    (a.expiresAt ? `\n(Auto-${a.onTimeout === 'approve' ? 'approves' : 'rejects'} at ${a.expiresAt.toISOString()})` : '');
  try {
    await services.connectors.notify.send(a.approver, text);
  } catch (err) {
    // The approval still stands in the queue (GET /api/approvals); a failed
    // notification shouldn't lose it.
    console.warn(`[approvals] could not notify ${a.approver}: ${(err as Error).message}`);
  }
  return approval;
}

export class ApprovalConflict extends Error {}

export async function decideApproval(db: Db, id: string, d: { decision: 'approved' | 'rejected'; by: string; note?: string; edits?: Record<string, unknown> }) {
  return tx(db, async c => {
    const { rows } = await c.query(
      `UPDATE approvals SET status = $2, decided_by = $3, note = $4, edits = $5, decided_at = now()
        WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, d.decision, d.by, d.note ?? null, d.edits ? JSON.stringify(d.edits) : null]);
    if (!rows.length) throw new ApprovalConflict('approval not found or already decided');
    const a: ApprovalRow = rows[0];
    const w = await c.query(`SELECT id FROM run_waits WHERE run_id = $1 AND key = $2 AND kind = 'approval'`, [a.run_id, a.step_key]);
    if (w.rows.length) await resolveWait(c, w.rows[0].id, { decision: d.decision, by: d.by, note: d.note ?? null, edits: d.edits ?? null });
    await queueRun(c, a.run_id);
    return a;
  });
}
