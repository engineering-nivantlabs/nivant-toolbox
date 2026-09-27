import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { parseDuration, resolve } from '../src/expr.js';
import { buildServer } from '../src/server.js';
import { startScheduler } from '../src/triggers.js';
import { checkWorkflow } from '../src/workflow.js';
import { pendingApprovals, projectWith, setup, start, TEMPLATES } from './helpers.js';

/** A project with the standard support files plus ad-hoc workflows written inline. */
function project(workflows: Record<string, string>) {
  const dir = projectWith([]);
  for (const [name, yaml] of Object.entries(workflows)) fs.writeFileSync(path.join(dir, 'workflows', `${name}.yaml`), yaml);
  return dir;
}

test('expressions: templates keep types, interpolate, and durations parse', async () => {
  const ctx = { a: 5, b: { c: [1, 2] }, s: 'x' };
  assert.equal(await resolve('{{ a }}', ctx), 5);
  assert.deepEqual(await resolve('{{ b.c }}', ctx), [1, 2]);
  assert.equal(await resolve('n={{ a }} s={{ s }}', ctx), 'n=5 s=x');
  assert.equal(await resolve('{{ s }} — {{ a }}', ctx), 'x — 5');
  assert.deepEqual(await resolve({ k: ['{{ a + 1 }}'] }, ctx), { k: [6] });
  assert.equal(parseDuration('1h30m'), 5_400_000);
  assert.equal(parseDuration('-3d'), -259_200_000);
  assert.throws(() => parseDuration('soon'));
});

test('workflow validation reports every problem with its location', () => {
  const { problems } = checkWorkflow({
    workflow: 'x', version: 1, mode: 'auto',
    triggers: [{ id: 't', use: 'send.email' }],
    steps: [
      { use: 'ai.nope' },
      { id: 'a', use: 'control.branch', branches: [{ when: 'x >', steps: [{ use: 'data.transform', set: {} }] }] },
      { id: 'a', use: 'data.transform', set: '{{ foo( }}' },
      { id: 'b', use: 'control.wait', for: '1h', event: { channel: 'email', key: 'k' } },
      { id: 'c', use: 'ai.qualify', input: 'x', rubric: 'missing.md' },
    ],
  }, TEMPLATES);
  const text = problems.join('\n');
  assert.match(text, /triggers\[0\] \(t\): send\.email is not a trigger/);
  assert.match(text, /steps\[0\]: top-level steps need an id/);
  assert.match(text, /unknown primitive "ai\.nope"/);
  assert.match(text, /branches\[0\]\.when: cannot parse expression "x >"/);
  assert.match(text, /duplicate id "a"/);
  assert.match(text, /set: cannot parse expression/);
  assert.match(text, /\(b\)\.\(params\): set for, until, or event/);
  assert.match(text, /rubric: rubrics\/missing\.md not found/);
});

test('side effects are at-most-once: a crash mid-send fails the step instead of re-sending', async () => {
  const dir = project({ send: `
workflow: send
version: 1
mode: auto
triggers: [{ id: t, use: trigger.api }]
steps:
  - id: mail
    use: send.email
    to: a@example.com
    subject: hi
    text: hello
` });
  const e = await setup({ configDir: dir });
  try {
    const runId = await start(e, 'send', 't', {});
    // Simulate a worker that crashed after marking the send as started.
    await e.services.db.query(`INSERT INTO run_steps (run_id, key, step_id, primitive, status) VALUES ($1, 'mail', 'mail', 'send.email', 'started')`, [runId]);
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'failed');
    assert.match(run.error, /interrupted during a side effect/);
    assert.equal(e.mail.messages.length, 0, 'did not guess and re-send');

    // An operator checks, then retries the run from the failed step.
    const app = buildServer(e.services);
    const res = await app.inject({ method: 'POST', url: `/api/runs/${runId}/retry`, headers: { authorization: 'Bearer test-admin-token-123456' } });
    assert.equal(res.statusCode, 200);
    await e.drain();
    assert.equal((await e.run(runId)).status, 'completed');
    assert.equal(e.mail.messages.length, 1);
    await app.close();
  } finally { await e.close(); fs.rmSync(dir, { recursive: true }); }
});

test('transient errors retry with back-off; permanent ones fail or continue per on_error', async () => {
  const dir = project({ flaky: `
workflow: flaky
version: 1
mode: auto
triggers: [{ id: t, use: trigger.api }]
steps:
  - id: soft
    use: integration.call
    connection: erp
    path: /soft
    on_error: continue
  - id: flaky
    use: integration.call
    connection: erp
    path: /flaky
  - id: after
    use: data.transform
    set: { soft_error: "{{ steps.soft.error }}", flaky: "{{ steps.flaky.data.ok }}" }
` });
  const e = await setup({ configDir: dir, env: { STEP_MAX_ATTEMPTS: '3' } });
  try {
    let calls = 0;
    e.fakes.routes.push(r => {
      if (r.path === '/conn/erp/soft') return { status: 400, body: { error: 'bad sku' } };
      if (r.path === '/conn/erp/flaky') return ++calls < 3 ? { status: 503, body: { error: 'busy' } } : { body: { ok: true } };
    });
    const runId = await start(e, 'flaky', 't', {});
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting', 'first 503 schedules a retry');
    await e.advance('1m'); await e.drain();
    await e.advance('3m'); await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    assert.equal(calls, 3);
    const after = (await e.steps(runId)).find(s => s.key === 'after')!.output;
    assert.match(after.soft_error, /400/);
    assert.equal(after.flaky, true);
  } finally { await e.close(); fs.rmSync(dir, { recursive: true }); }
});

test('approval timeouts apply on_timeout; a Stop ends the run as stopped, not failed', async () => {
  const dir = project({ gate: `
workflow: gate
version: 1
mode: auto
triggers: [{ id: t, use: trigger.api }]
steps:
  - id: soft
    use: control.approval
    title: auto-approves
    timeout: 1h
    on_timeout: approve
  - id: hard
    use: control.approval
    title: needs a yes
    timeout: 1h
` });
  const e = await setup({ configDir: dir });
  try {
    const runId = await start(e, 'gate', 't', {});
    await e.drain();
    await e.advance('61m'); await e.drain();
    assert.equal((await e.steps(runId)).find(s => s.key === 'soft')!.output.decision, 'approved');
    assert.equal((await pendingApprovals(e, runId))[0].title, 'needs a yes');
    await e.advance('61m'); await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'stopped');
    assert.match(run.stop_reason, /hard: expired/);
  } finally { await e.close(); fs.rmSync(dir, { recursive: true }); }
});

test('schedules fire once per tick even with several engine instances', async () => {
  const dir = project({ tick: `
workflow: tick
version: 1
mode: auto
triggers: [{ id: every, use: trigger.schedule, cron: "* * * * * *" }]
steps: [{ id: noop, use: data.transform, set: { at: "{{ trigger.scheduled_at }}" } }]
` });
  const e = await setup({ configDir: dir });
  try {
    const stopA = startScheduler(e.services);
    const stopB = startScheduler(e.services);
    await new Promise(r => setTimeout(r, 2300));
    stopA(); stopB();
    const { rows } = await e.services.db.query(`SELECT count(*)::int AS runs, count(DISTINCT trigger->>'scheduled_at')::int AS ticks FROM runs`);
    assert.ok(rows[0].runs >= 2, `fired ${rows[0].runs} times`);
    assert.equal(rows[0].runs, rows[0].ticks, 'no tick produced two runs');
  } finally { await e.close(); fs.rmSync(dir, { recursive: true }); }
});

test('admin API: auth, workflows, runs, cancel, events, tasks', async () => {
  const e = await setup({ workflows: ['order-status'] });
  const app = buildServer(e.services);
  const auth = { authorization: 'Bearer test-admin-token-123456' };
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/api/workflows' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/api/workflows', headers: { authorization: 'Bearer nope' } })).statusCode, 401);
    const wfs = (await app.inject({ method: 'GET', url: '/api/workflows', headers: auth })).json();
    assert.deepEqual(wfs.map((w: any) => w.workflow), ['order-status']);
    assert.equal((await app.inject({ method: 'GET', url: '/health' })).json().ok, true);

    const ev = await app.inject({ method: 'POST', url: '/api/events', headers: auth, payload: { channel: 'whatsapp', correlation: ['111'], payload: { from: '111', type: 'text', text: 'return please' } } });
    const runId = ev.json().started[0];
    const cancel = await app.inject({ method: 'POST', url: `/api/runs/${runId}/cancel`, headers: auth });
    assert.equal(cancel.statusCode, 200);
    await e.drain();
    assert.equal((await e.run(runId)).status, 'cancelled', 'cancelled runs are never picked up');

    const created = await app.inject({ method: 'POST', url: '/api/workflows/order-status/runs', headers: auth, payload: { trigger_id: 'wa', payload: { from: '222', type: 'text', text: 'I want to return this' } } });
    assert.equal(created.statusCode, 201);
    e.fakes.ai.push(({ task }) => (task.startsWith('Classify') ? { label: 'return', confidence: 0.9, reason: 'return', language: 'en' } : task.startsWith('Read the customer') ? { sentiment: 'neutral', tone: 'calm', urgency: 'low', rating: null } : undefined));
    await e.drain();
    const detail = (await app.inject({ method: 'GET', url: `/api/runs/${created.json().id}`, headers: auth })).json();
    assert.equal(detail.status, 'completed');
    assert.ok(detail.steps.some((s: any) => s.key === 'route/b1/return_task'));
    const tasks = (await app.inject({ method: 'GET', url: '/api/tasks', headers: auth })).json();
    assert.equal(tasks.length, 1);
    assert.equal((await app.inject({ method: 'POST', url: `/api/tasks/${tasks[0].id}/done`, headers: auth })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/api/tasks', headers: auth })).json().length, 0);
  } finally { await app.close(); await e.close(); }
});
