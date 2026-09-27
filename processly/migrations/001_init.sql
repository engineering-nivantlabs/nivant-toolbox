-- Processly engine schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One row per workflow execution. `definition` is a snapshot of the workflow
-- at start, so a run replays against the exact version it began with.
CREATE TABLE runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow      text        NOT NULL,
  version       integer     NOT NULL,
  mode          text        NOT NULL CHECK (mode IN ('auto', 'review')),
  definition    jsonb       NOT NULL,
  trigger_id    text,
  trigger       jsonb       NOT NULL DEFAULT '{}',
  status        text        NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'waiting', 'completed', 'stopped', 'failed', 'cancelled')),
  wake_at       timestamptz,
  locked_by     text,
  locked_until  timestamptz,
  error         text,
  stop_reason   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX runs_claimable ON runs (status, wake_at) WHERE status IN ('queued', 'waiting', 'running');
CREATE INDEX runs_workflow ON runs (workflow, created_at DESC);

-- Every step execution, keyed by its position in the workflow tree
-- (e.g. "route/b0/crm", "offer/2/send_offer"). Replay reuses completed rows.
CREATE TABLE run_steps (
  seq          bigserial   PRIMARY KEY,
  run_id       uuid        NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  key          text        NOT NULL,
  step_id      text,
  primitive    text        NOT NULL,
  status       text        NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  attempts     integer     NOT NULL DEFAULT 1,
  input        jsonb,
  output       jsonb,
  error        text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  UNIQUE (run_id, key)
);

-- Timers, external events and approvals a run is suspended on.
CREATE TABLE run_waits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid        NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  key          text        NOT NULL,
  kind         text        NOT NULL CHECK (kind IN ('timer', 'event', 'approval')),
  channel      text,
  correlation  text[],
  since        timestamptz NOT NULL DEFAULT now(),
  wake_at      timestamptz,
  resolved_at  timestamptz,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, key)
);
CREATE INDEX run_waits_open_events ON run_waits USING gin (correlation) WHERE kind = 'event' AND resolved_at IS NULL;

CREATE TABLE approvals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid        NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
  step_key    text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('gate', 'review')),
  title       text        NOT NULL,
  detail      jsonb       NOT NULL DEFAULT '{}',
  approver    text,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decided_by  text,
  note        text,
  edits       jsonb,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz,
  UNIQUE (run_id, step_key)
);
CREATE INDEX approvals_pending ON approvals (created_at) WHERE status = 'pending';

-- Inbound events (messages, emails, webhooks), kept for audit, idempotency
-- and for waits that begin just after the event arrived.
CREATE TABLE events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      text        NOT NULL,
  correlation  text[]      NOT NULL DEFAULT '{}',
  idem_key     text,
  payload      jsonb       NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  consumed_by  uuid,
  started_runs uuid[]      NOT NULL DEFAULT '{}',
  UNIQUE (channel, idem_key)
);
CREATE INDEX events_correlation ON events USING gin (correlation);

-- Cron de-duplication across workers.
CREATE TABLE schedule_fires (
  workflow   text        NOT NULL,
  trigger_id text        NOT NULL,
  fire_at    timestamptz NOT NULL,
  run_id     uuid,
  PRIMARY KEY (workflow, trigger_id, fire_at)
);

-- Built-in stores used by the internal providers and data primitives.
CREATE TABLE crm_records (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  object      text        NOT NULL,
  stage       text,
  data        jsonb       NOT NULL DEFAULT '{}',
  run_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_records_object ON crm_records (object, created_at DESC);

CREATE TABLE tasks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid,
  title        text        NOT NULL,
  body         text,
  assignee     text,
  due_at       timestamptz,
  status       text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE dedupe_keys (
  namespace   text        NOT NULL,
  key         text        NOT NULL,
  first_run   uuid,
  last_run    uuid,
  count       integer     NOT NULL DEFAULT 1,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, key)
);

CREATE TABLE records (
  collection  text        NOT NULL,
  key         text        NOT NULL,
  data        jsonb       NOT NULL,
  run_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, key)
);

CREATE TABLE files (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  mime        text        NOT NULL,
  size        bigint      NOT NULL,
  sha256      text        NOT NULL,
  path        text        NOT NULL,
  folder      text,
  meta        jsonb       NOT NULL DEFAULT '{}',
  run_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar    text        NOT NULL,
  title       text        NOT NULL,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  kind        text        NOT NULL DEFAULT 'booking' CHECK (kind IN ('booking', 'hold')),
  attendees   text[]      NOT NULL DEFAULT '{}',
  description text,
  run_id      uuid,
  cancelled   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_calendar ON bookings (calendar, starts_at) WHERE NOT cancelled;

-- Attach to any of your own tables to fire trigger.db_event workflows:
--   CREATE TRIGGER jobs_processly AFTER INSERT OR UPDATE ON jobs
--     FOR EACH ROW EXECUTE FUNCTION processly_notify();
CREATE FUNCTION processly_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('processly_events', json_build_object(
    'table', TG_TABLE_NAME,
    'op', lower(TG_OP),
    'row', row_to_json(NEW),
    'old', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) END
  )::text);
  RETURN NEW;
END $$;
