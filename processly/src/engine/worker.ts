import os from 'node:os';
import { Interpreter } from './interpreter.js';
import { claimRun, extendLock, finishRun, RunRow } from './store.js';
import type { Services } from './types.js';

const LOCK_MS = 5 * 60_000;

export async function executeRun(services: Services, run: RunRow, worker: string) {
  const log = (m: string) => console.log(`[run ${run.id.slice(0, 8)} ${run.workflow}] ${m}`);
  const heartbeat = setInterval(() => extendLock(services.db, run.id, worker, LOCK_MS).catch(() => {}), LOCK_MS / 5);
  try {
    const outcome = await new Interpreter(run, services, log).execute();
    switch (outcome.status) {
      case 'completed': await finishRun(services.db, run.id, worker, { status: 'completed' }); log('completed'); break;
      case 'waiting': await finishRun(services.db, run.id, worker, { status: 'waiting', wake_at: outcome.wakeAt }); log(`waiting${outcome.wakeAt ? ` until ${outcome.wakeAt.toISOString()}` : ' for an event'}`); break;
      case 'stopped': await finishRun(services.db, run.id, worker, { status: 'stopped', stop_reason: outcome.reason }); log(`stopped: ${outcome.reason}`); break;
      case 'failed': await finishRun(services.db, run.id, worker, { status: 'failed', error: outcome.error }); log(`failed: ${outcome.error}`); break;
    }
    return outcome;
  } catch (err) {
    // Engine bug or database outage: mark failed so it's visible, never loop.
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error(`[run ${run.id}] crashed`, err);
    await finishRun(services.db, run.id, worker, { status: 'failed', error: `engine error: ${msg}` }).catch(() => {});
    return { status: 'failed' as const, error: msg };
  } finally {
    clearInterval(heartbeat);
  }
}

/** Polls for runnable runs and executes up to `concurrency` at a time. */
export class Worker {
  readonly id = `${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;
  private active = 0;
  private stopping = false;
  private timer: NodeJS.Timeout | null = null;
  private idle: (() => void)[] = [];

  constructor(private services: Services) {}

  start() {
    this.stopping = false;
    this.tick();
  }

  /** Runs everything currently runnable, then resolves (used by tests and `processly run`). */
  async drain(maxExecutions = 500) {
    for (let i = 0; i < maxExecutions; i++) {
      const run = await claimRun(this.services.db, this.id, LOCK_MS);
      if (!run) return;
      await executeRun(this.services, run, this.id);
    }
    throw new Error(`drain: still runnable after ${maxExecutions} executions (a run keeps waking immediately?)`);
  }

  private tick = async () => {
    if (this.stopping) return;
    try {
      while (this.active < this.services.config.WORKER_CONCURRENCY) {
        const run = await claimRun(this.services.db, this.id, LOCK_MS);
        if (!run) break;
        this.active++;
        executeRun(this.services, run, this.id).finally(() => {
          this.active--;
          if (this.active === 0) this.idle.splice(0).forEach(r => r());
          if (!this.stopping) setImmediate(this.tick);
        });
      }
    } catch (err) {
      console.error('[worker] poll failed', err);
    }
    if (!this.stopping) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(this.tick, this.services.config.WORKER_POLL_MS);
    }
  };

  async stop() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.active) await new Promise<void>(r => this.idle.push(r));
  }
}
