import { isDeepStrictEqual } from 'node:util';
import { PRIMITIVE_BY_ID, Primitive } from '../catalog.js';
import { evaluate, ExprError, parseDuration, resolve, toMillis, truthy } from '../expr.js';
import { stepParams, Step } from '../workflow.js';
import { HANDLERS } from '../primitives/index.js';
import { createApproval, approvalLink } from './approvals.js';
import { consumeMatchingEvent } from './events.js';
import { insertWait, loadSteps, loadWaits, resolveWait, RunRow, saveStep, StepRow, WaitRow } from './store.js';
import { Services, Stop, StepError } from './types.js';

/** Thrown to park the run until `wakeAt` (or until an event/approval arrives). */
export class Suspend extends Error {
  constructor(public wakeAt: Date | null) { super('suspended'); }
}

/** A step failed for good; the run fails unless a retry/on_error handles it. */
export class StepFailure extends Error {
  constructor(public key: string, message: string) { super(`${key}: ${message}`); }
}

export type Outcome =
  | { status: 'completed' }
  | { status: 'waiting'; wakeAt: Date | null }
  | { status: 'stopped'; reason: string }
  | { status: 'failed'; error: string };

type Scope = Record<string, unknown> & { steps: Record<string, unknown> };

/**
 * Executes a run by walking its workflow from the top. Every step result is
 * recorded under a stable key; on resume the walk replays recorded results
 * and continues from the first step that hasn't finished. Decisions (which
 * branch, which items) are recorded too, so a replay always takes the same path.
 */
export class Interpreter {
  private steps = new Map<string, StepRow>();
  private waits = new Map<string, WaitRow>();
  private ctx!: Scope;
  private lastProgress: Date;

  constructor(private run: RunRow, private services: Services, private log: (msg: string) => void = () => {}) {
    this.lastProgress = run.created_at;
  }

  async execute(): Promise<Outcome> {
    const { db, project } = this.services;
    for (const s of await loadSteps(db, this.run.id)) this.steps.set(s.key, s);
    for (const w of await loadWaits(db, this.run.id)) this.waits.set(w.key, w);

    this.ctx = {
      trigger: this.run.trigger, trigger_id: this.run.trigger_id, steps: {},
      run: { id: this.run.id, workflow: this.run.workflow, version: this.run.version, started_at: this.run.created_at.toISOString() },
      business: project.business,
    };
    // Outputs of finished steps are visible to later expressions.
    for (const s of this.steps.values()) {
      if (s.status === 'completed' && s.step_id) this.ctx.steps[s.step_id] = s.output;
      if (s.finished_at && s.finished_at > this.lastProgress) this.lastProgress = s.finished_at;
    }

    try {
      await this.list(this.run.definition.steps, '', this.ctx);
      return { status: 'completed' };
    } catch (err) {
      if (err instanceof Suspend) return { status: 'waiting', wakeAt: err.wakeAt };
      if (err instanceof Stop) return { status: 'stopped', reason: err.reason };
      if (err instanceof StepFailure) return { status: 'failed', error: err.message };
      if (err instanceof ExprError) return { status: 'failed', error: err.message };
      throw err;
    }
  }

  private async list(steps: Step[], prefix: string, scope: Scope) {
    for (let i = 0; i < steps.length; i++) await this.step(steps[i], prefix + (steps[i].id ?? `#${i}`), scope);
  }

  private now() { return this.services.now(); }

  private async record(key: string, s: Step | null, primitive: string, patch: Partial<StepRow> & { status: StepRow['status'] }) {
    const row = await saveStep(this.services.db, this.run.id, { key, step_id: s?.id ?? null, primitive, ...patch });
    this.steps.set(key, row);
    if (row.finished_at) this.lastProgress = row.finished_at;
    if (patch.status === 'completed' && s?.id) this.ctx.steps[s.id] = patch.output ?? null;
    return row;
  }

  /** Evaluates `fn` once per run and replays the stored answer afterwards. */
  private async decide<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const done = this.steps.get(key);
    if (done?.status === 'completed') return done.output as T;
    const value = await fn();
    await this.record(key, null, 'decision', { status: 'completed', output: value });
    return value;
  }

  private async step(s: Step, key: string, scope: Scope) {
    const done = this.steps.get(key);
    if (done && (done.status === 'completed' || done.status === 'skipped')) {
      // Replaying: later steps see this step's result as of this point in the run
      // (matters inside loops, where the same step id repeats per iteration).
      if (s.id) this.ctx.steps[s.id] = done.status === 'completed' ? done.output : { skipped: true };
      return;
    }
    // A step that failed for good stays failed on replay (a retry block moves on to its next attempt).
    if (done?.status === 'failed' && !(done.output as { retrying?: boolean } | null)?.retrying) {
      if (s.on_error === 'continue') { if (s.id) this.ctx.steps[s.id] = { error: done.error }; return; }
      throw new StepFailure(key, done.error ?? 'failed');
    }
    const p = PRIMITIVE_BY_ID.get(s.use)!;

    if (s.if) {
      const run = await this.decide(`${key}/@if`, () => truthy(s.if!, scope));
      if (!run) {
        await this.record(key, s, s.use, { status: 'skipped', output: { skipped: true } });
        if (s.id) this.ctx.steps[s.id] = { skipped: true };
        this.log(`${key}: skipped (if: ${s.if})`);
        return;
      }
    }

    if (p.container) return this.container(s, p, key, scope);
    if (s.use === 'control.wait') return this.wait(s, key, scope);
    if (s.use === 'control.approval') return this.approval(s, key, scope);
    return this.primitive(s, p, key, scope);
  }

  private async params(s: Step, p: Primitive, scope: Scope) {
    const raw = stepParams(s);
    const out: Record<string, unknown> = {};
    try {
      for (const [k, v] of Object.entries(raw)) out[k] = p.control?.includes(k) ? v : await resolve(v, scope);
    } catch (err) {
      throw new StepFailure(s.id ?? s.use, (err as Error).message);
    }
    return out;
  }

  private parse(p: Primitive, key: string, params: unknown) {
    const r = p.params.safeParse(params);
    if (!r.success) throw new StepFailure(key, `invalid parameters for ${p.id}: ${r.error.issues.map(i => `${i.path.join('.') || '(root)'} ${i.message}`).join('; ')}`);
    return r.data as Record<string, unknown>;
  }

  // ------------------------------------------------------------- primitives

  private async primitive(s: Step, p: Primitive, key: string, scope: Scope) {
    const prev = this.steps.get(key);
    const maxAttempts = this.services.config.STEP_MAX_ATTEMPTS;
    let params = this.parse(p, key, await this.params(s, p, scope));
    const sideEffect = p.cat === 'action' && !p.readOnly?.(params);

    if (sideEffect && this.run.mode === 'review') {
      const review = await this.gate(`${key}/review`, {
        kind: 'review', approver: 'manager',
        title: `Review: ${s.label ?? p.label} (${this.run.workflow})`,
        detail: { step: s.id ?? key, primitive: p.id, params },
      });
      if (review.decision !== 'approved') throw new Stop(`${key} rejected in review${review.note ? `: ${review.note}` : ''}`);
      if (review.edits && Object.keys(review.edits).length) params = this.parse(p, key, { ...params, ...review.edits });
    }

    // At-most-once for side effects: if a previous attempt crashed after
    // starting the call, we can't know whether it happened. Don't guess.
    if (prev?.status === 'started' && sideEffect && !params.idempotent) {
      await this.record(key, s, p.id, { status: 'failed', attempts: prev.attempts, error: 'interrupted while running; it may or may not have happened. Check and re-run manually.' });
      throw new StepFailure(key, 'interrupted during a side effect (may or may not have been sent); not retrying automatically');
    }

    const attempt = prev?.status === 'failed' ? prev.attempts + 1 : 1;
    if (sideEffect) await this.record(key, s, p.id, { status: 'started', attempts: attempt, input: params });

    const handler = HANDLERS[p.id];
    try {
      const output = await handler(params, {
        run: this.run, key, stepId: s.id, services: this.services, scope,
        idempotencyKey: `${this.run.id}:${key}`,
        log: m => this.log(`${key}: ${m}`),
      });
      await this.record(key, s, p.id, { status: 'completed', attempts: attempt, input: params, output: output ?? null });
      this.log(`${key}: ${p.id} ✓`);
    } catch (err) {
      if (err instanceof Stop) {
        await this.record(key, s, p.id, { status: 'completed', attempts: attempt, input: params, output: { stopped: err.reason } });
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      const retryable = err instanceof StepError ? err.retryable : !(err instanceof StepFailure);
      if (retryable && attempt < maxAttempts) {
        await this.record(key, s, p.id, { status: 'failed', attempts: attempt, input: params, error: message, output: { retrying: true } });
        const backoff = Math.min(30_000 * 4 ** (attempt - 1), 30 * 60_000);
        this.log(`${key}: attempt ${attempt} failed (${message}); retrying in ${Math.round(backoff / 1000)}s`);
        throw new Suspend(new Date(this.now().getTime() + backoff));
      }
      if (s.on_error === 'continue') {
        await this.record(key, s, p.id, { status: 'failed', attempts: attempt, input: params, error: message });
        if (s.id) this.ctx.steps[s.id] = { error: message };
        this.log(`${key}: failed, continuing (${message})`);
        return;
      }
      await this.record(key, s, p.id, { status: 'failed', attempts: attempt, input: params, error: message });
      throw new StepFailure(key, message);
    }
  }

  // ------------------------------------------------------------ containers

  private async container(s: Step, p: Primitive, key: string, scope: Scope) {
    const params = this.parse(p, key, await this.params(s, p, scope));
    const branches = s.branches!;
    let output: unknown;

    if (s.use === 'control.branch' || s.use === 'control.switch') {
      const chosen = await this.decide(`${key}/@`, async () => {
        if (s.use === 'control.switch') {
          const value = await evaluate(String(params.on), scope);
          const i = branches.findIndex(b => b.otherwise || (Array.isArray(b.case) ? b.case.some(c => isDeepStrictEqual(c, value)) : isDeepStrictEqual(b.case, value)));
          return { index: i, value };
        }
        for (let i = 0; i < branches.length; i++) if (branches[i].otherwise || await truthy(branches[i].when!, scope)) return { index: i };
        return { index: -1 };
      });
      if (chosen.index >= 0) {
        const b = branches[chosen.index];
        this.log(`${key}: → ${b.label ?? b.when ?? JSON.stringify(b.case) ?? 'otherwise'}`);
        await this.list(b.steps, `${key}/b${chosen.index}/`, scope);
      }
      const b = branches[chosen.index];
      output = { branch: chosen.index >= 0 ? (b.label ?? b.when ?? (b.otherwise ? 'otherwise' : b.case)) : null, index: chosen.index };
    }

    if (s.use === 'control.loop') {
      const body = branches[0].steps;
      let iterations = 0, stoppedEarly = false;
      if (params.over) {
        const items = await this.decide(`${key}/@items`, async () => {
          const v = await evaluate(String(params.over), scope);
          return (Array.isArray(v) ? v : v == null ? [] : [v]).slice(0, Number(params.max));
        });
        for (let j = 0; j < items.length; j++) {
          const inner = { ...scope, item: items[j], index: j };
          await this.list(body, `${key}/${j}/`, inner);
          iterations++;
          if (params.stop_when && await this.decide(`${key}/${j}/@stop`, () => truthy(String(params.stop_when), inner))) { stoppedEarly = true; break; }
        }
      } else {
        const every = parseDuration(params.every as string);
        for (let j = 0; j < Number(params.max); j++) {
          if (j > 0) await this.timer(`${key}/${j}/@every`, every);
          const inner = { ...scope, index: j };
          if (params.while && !(await this.decide(`${key}/${j}/@while`, () => truthy(String(params.while), inner)))) break;
          await this.list(body, `${key}/${j}/`, inner);
          iterations++;
          if (params.stop_when && await this.decide(`${key}/${j}/@stop`, () => truthy(String(params.stop_when), inner))) { stoppedEarly = true; break; }
        }
      }
      output = { iterations, stopped_early: stoppedEarly };
    }

    if (s.use === 'control.retry') {
      const ladder = (params.backoff as (string | number)[]).map(parseDuration);
      const body = branches[0].steps;
      let lastError = '';
      output = undefined;
      for (let a = 0; a <= ladder.length; a++) {
        try {
          await this.list(body, `${key}/a${a}/`, scope);
          output = { ok: true, attempts: a + 1 };
          break;
        } catch (err) {
          if (!(err instanceof StepFailure)) throw err;
          lastError = err.message;
          this.log(`${key}: attempt ${a + 1} failed`);
          if (a < ladder.length) await this.timer(`${key}/a${a}/@backoff`, ladder[a]);
        }
      }
      if (!output) {
        if (params.on_exhausted === 'fail') throw new StepFailure(key, `all ${ladder.length + 1} attempts failed; last: ${lastError}`);
        output = { ok: false, attempts: ladder.length + 1, error: lastError };
      }
    }

    await this.record(key, s, p.id, { status: 'completed', output });
  }

  // ----------------------------------------------------------------- waits

  /** Internal fixed-duration timer (loop cadence, retry back-off). */
  private async timer(key: string, ms: number) {
    if (this.steps.get(key)?.status === 'completed') return;
    let w = this.waits.get(key);
    if (!w) {
      w = await insertWait(this.services.db, { run_id: this.run.id, key, kind: 'timer', wake_at: new Date(this.now().getTime() + ms) });
      this.waits.set(key, w);
    }
    if (w.wake_at! > this.now()) throw new Suspend(w.wake_at);
    await resolveWait(this.services.db, w.id, { waited_until: w.wake_at });
    await this.record(key, null, 'timer', { status: 'completed', output: { waited_until: w.wake_at } });
  }

  private async wait(s: Step, key: string, scope: Scope) {
    const p = PRIMITIVE_BY_ID.get('control.wait')!;
    const db = this.services.db;
    let w = this.waits.get(key);
    const now = this.now();

    if (!w) {
      const params = this.parse(p, key, await this.params(s, p, scope)) as { for?: string; until?: string | number; event?: { channel: string; key: string | string[] }; timeout?: string };
      if (params.event) {
        const correlation = (Array.isArray(params.event.key) ? params.event.key : [params.event.key]).filter(Boolean).map(String);
        if (!correlation.length) throw new StepFailure(key, 'wait.event.key resolved to nothing to match on');
        const wakeAt = params.until != null ? new Date(toMillis(params.until)) : params.timeout ? new Date(now.getTime() + parseDuration(params.timeout)) : null;
        w = await insertWait(db, { run_id: this.run.id, key, kind: 'event', channel: params.event.channel, correlation, since: this.lastProgress, wake_at: wakeAt });
        // The event may have arrived between the previous step and this wait.
        const early = await consumeMatchingEvent(db, w, this.run.id);
        if (early) w = { ...w, resolved_at: now, payload: early };
      } else {
        const wakeAt = params.for != null ? new Date(now.getTime() + parseDuration(params.for)) : new Date(toMillis(params.until!));
        w = await insertWait(db, { run_id: this.run.id, key, kind: 'timer', wake_at: wakeAt });
      }
      this.waits.set(key, w);
    }

    let output: unknown;
    if (w.kind === 'event') {
      if (w.resolved_at) output = { received: true, timed_out: false, event: w.payload };
      else if (w.wake_at && w.wake_at <= now) {
        await resolveWait(db, w.id, null);
        output = { received: false, timed_out: true, event: null };
      } else throw new Suspend(w.wake_at);
    } else {
      if (w.wake_at! > now) throw new Suspend(w.wake_at);
      await resolveWait(db, w.id, null);
      output = { waited_until: w.wake_at };
    }
    await this.record(key, s, 'control.wait', { status: 'completed', output });
    this.log(`${key}: wait over`);
  }

  // ------------------------------------------------------------- approvals

  private async approval(s: Step, key: string, scope: Scope) {
    const p = PRIMITIVE_BY_ID.get('control.approval')!;
    const params = this.parse(p, key, await this.params(s, p, scope)) as { title: string; detail?: unknown; approver: string; timeout?: string; on_timeout: 'approve' | 'reject'; on_reject: 'stop' | 'continue' };
    const result = await this.gate(key, { kind: 'gate', title: params.title, detail: params.detail ?? {}, approver: params.approver, timeout: params.timeout, onTimeout: params.on_timeout });
    await this.record(key, s, 'control.approval', { status: 'completed', output: result });
    if (result.decision !== 'approved' && params.on_reject === 'stop') throw new Stop(`${key}: ${result.decision}${result.note ? ` (${result.note})` : ''}`);
  }

  /** Suspends until a person decides; returns the decision. */
  private async gate(key: string, a: { kind: 'gate' | 'review'; title: string; detail: unknown; approver: string; timeout?: string; onTimeout?: 'approve' | 'reject' }) {
    const done = this.steps.get(key);
    if (done?.status === 'completed' && done.primitive !== 'control.approval') return done.output as { decision: string; note?: string; edits?: Record<string, unknown> };
    const db = this.services.db;
    let w = this.waits.get(key);
    if (!w) {
      const expires = a.timeout ? new Date(this.now().getTime() + parseDuration(a.timeout)) : null;
      const approval = await createApproval(this.services, this.run, key, { ...a, expiresAt: expires, onTimeout: a.onTimeout ?? 'reject' });
      w = await insertWait(db, { run_id: this.run.id, key, kind: 'approval', wake_at: expires, payload: { approval_id: approval.id } });
      this.waits.set(key, w);
      this.log(`${key}: waiting for approval → ${approvalLink(this.services, approval.id)}`);
    }
    if (!w.resolved_at) {
      if (w.wake_at && w.wake_at <= this.now()) {
        const { rows } = await db.query(
          `UPDATE approvals SET status = 'expired', decided_at = now() WHERE run_id = $1 AND step_key = $2 AND status = 'pending' RETURNING detail`, [this.run.id, key]);
        const decision = rows.length ? ((a.onTimeout ?? 'reject') === 'approve' ? 'approved' : 'expired') : 'expired';
        await resolveWait(db, w.id, { decision, by: 'timeout' });
        w = { ...w, resolved_at: this.now(), payload: { decision, by: 'timeout' } };
      } else throw new Suspend(w.wake_at);
    }
    const result = w.payload as { decision: string; by?: string; note?: string; edits?: Record<string, unknown> };
    if (a.kind === 'review') await this.record(key, null, 'review', { status: 'completed', output: result });
    return result;
  }
}
