import type { Config } from '../config.js';
import type { Db } from '../db.js';
import type { Project } from '../project.js';
import type { RunRow } from './store.js';
import type { Connectors } from '../connectors/index.js';

/** A step failed. Retryable errors are retried with back-off up to STEP_MAX_ATTEMPTS. */
export class StepError extends Error {
  constructor(message: string, public retryable = false) { super(message); }
}

/** Ends the run gracefully (validation said stop, an approver said no). */
export class Stop extends Error {
  constructor(public reason: string) { super(reason); }
}

export interface Services {
  db: Db;
  config: Config;
  project: Project;
  connectors: Connectors;
  now(): Date;
}

export interface StepContext {
  run: RunRow;
  key: string;
  stepId?: string;
  /** Stable per run + step: safe to pass to APIs that de-duplicate. */
  idempotencyKey: string;
  services: Services;
  /** The run context expressions see (trigger, steps, item, ...). */
  scope: Record<string, unknown>;
  log(msg: string): void;
}

export type Handler = (params: any, sc: StepContext) => Promise<unknown>;
