import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { buildServer } from '../src/server.js';
import { setup, whatsappWebhook, type Env } from './helpers.js';

let env: Env;
let app: ReturnType<typeof buildServer>;

const sign = (body: string) => 'sha256=' + crypto.createHmac('sha256', 'wa-app-secret').update(body).digest('hex');
const postWhatsApp = (payload: object, signature?: string) => {
  const body = JSON.stringify(payload);
  return app.inject({ method: 'POST', url: '/hooks/whatsapp', payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature ?? sign(body) } });
};

before(async () => {
  env = await setup({ workflows: ['speed-to-lead-realestate'], now: '2026-10-05T19:47:00Z' });
  app = buildServer(env.services);
  await env.services.db.query(`INSERT INTO listings (title, area, bedrooms, rent, sqft, features) VALUES
    ('Marina Tower 2BHK', 'Dubai Marina', 2, 130000, 1100, 'sea view, gym'),
    ('Marina Heights 1BHK', 'Dubai Marina', 1, 85000, 750, 'balcony'),
    ('Downtown Loft', 'Downtown', 2, 160000, 1200, 'burj view')`);
});
after(async () => { await app.close(); await env.close(); });
beforeEach(() => env.fakes.reset());

test('rejects webhooks with a bad signature', async () => {
  const res = await postWhatsApp(whatsappWebhook({ from: '971501234567', text: 'hi' }), 'sha256=bad');
  assert.equal(res.statusCode, 401);
});

test('hot WhatsApp lead: extract → match → qualify → CRM + slots + reply, then wait for a reply', async () => {
  env.fakes.ai.push(({ task }) => {
    if (task.startsWith('Extract')) return { intent: 'viewing', area: 'Marina', bedrooms: 2, budget: 130000, timeline: 'next month' };
    if (task.startsWith('Score')) return { score: 0.87, label: 'hot', reasons: ['exact unit named', 'budget matches'] };
    if (task.startsWith('Write')) return { text: 'Hi Sara! Yes, the Marina Tower 2BHK is available. Tue 10:00 or Wed 10:00?' };
  });

  const res = await postWhatsApp(whatsappWebhook({ from: '971501234567', name: 'Sara Ahmed', text: 'Is the 2BHK in Marina Tower available? Budget 130k/yr, moving next month', id: 'wamid.in.1' }));
  assert.equal(res.statusCode, 200);
  const runId = res.json().results[0].started[0];
  assert.ok(runId, 'a run was started');

  // Meta retries webhooks: the same message id must not start a second run.
  const dup = await postWhatsApp(whatsappWebhook({ from: '971501234567', text: 'same', id: 'wamid.in.1' }));
  assert.equal(dup.json().results[0].duplicate, true);

  await env.drain();
  let run = await env.run(runId);
  assert.equal(run.status, 'waiting', run.error ?? '');

  const steps = await env.steps(runId);
  const byKey = Object.fromEntries(steps.map(s => [s.key, s]));
  assert.equal(byKey.normalize.output.phone, '971501234567');
  assert.equal(byKey.listings.output.count, 1, 'SQL filters to the one 2-bed Marina listing');
  assert.equal(byKey.listings.output.first.title, 'Marina Tower 2BHK');
  assert.equal(byKey['route/b0/crm'].status, 'completed');
  assert.equal(byKey['route/b0/slots'].output.count, 2);

  // Claude was called with the configured model, structured output and fallbacks.
  const call = env.fakes.aiCalls[0];
  assert.equal(call.model, 'claude-opus-5');
  assert.equal(call.fallbacks, 'default');
  assert.match(call.betas ?? '', /server-side-fallback-2026-07-01/);
  assert.equal(call.schema.type, 'object');

  const crm = await env.services.db.query(`SELECT * FROM crm_records`);
  assert.equal(crm.rows[0].stage, 'hot');
  assert.equal(crm.rows[0].data.budget, 130000);

  const wa = env.fakes.whatsappSent();
  const toSara = wa.filter(m => m.to === '971501234567');
  assert.equal(toSara.length, 1);
  assert.match(toSara[0].text.body, /Marina Tower 2BHK/);
  assert.ok(wa.some(m => m.to === '971500000002' && /Hot lead \(87%\)/.test(m.text.body)), 'agent Rana notified on WhatsApp');

  // Sara answers: the reply resumes this run instead of starting a new lead.
  const reply = await postWhatsApp(whatsappWebhook({ from: '971501234567', name: 'Sara Ahmed', text: 'Tuesday 10 works!' }));
  assert.equal(reply.json().results[0].resumed, runId);
  assert.deepEqual(reply.json().results[0].started, []);
  await env.drain();
  run = await env.run(runId);
  assert.equal(run.status, 'completed', run.error ?? '');
  assert.ok(env.fakes.whatsappSent().some(m => m.to === '971500000002' && /replied: Tuesday 10 works!/.test(m.text.body)));
});

test('no reply within 24h sends the follow-up nudge', async () => {
  env.fakes.ai.push(({ task }) => {
    if (task.startsWith('Score')) return { score: 0.9, label: 'hot', reasons: [] };
    if (task.startsWith('Write')) return { text: 'Hi Omar, viewing slots are…' };
  });
  const res = await postWhatsApp(whatsappWebhook({ from: '971509999999', name: 'Omar Khan', text: '2 bed Marina, 120k' }));
  const runId = res.json().results[0].started[0];
  await env.drain();
  assert.equal((await env.run(runId)).status, 'waiting');

  await env.advance('23h');
  await env.drain();
  assert.equal((await env.run(runId)).status, 'waiting', 'still inside the 24h window');

  await env.advance('2h');
  await env.drain();
  const run = await env.run(runId);
  assert.equal(run.status, 'completed', run.error ?? '');
  const nudge = env.fakes.whatsappSent().filter(m => m.to === '971509999999').pop();
  assert.match(nudge.text.body, /^Hi Omar, just checking in/);
});

test('portal form lead goes through the same workflow, and repeat contacts are flagged', async () => {
  env.fakes.ai.push(({ task }) => (task.startsWith('Score') ? { score: 0.3, label: 'cold', reasons: [] } : undefined));
  const post = () => app.inject({ method: 'POST', url: '/hooks/form/speed-to-lead-realestate', payload: { name: 'Lee', phone: '+971 50 777 8888', email: 'lee@example.com', message: 'Just browsing' } });
  const r1 = await post();
  assert.equal(r1.statusCode, 200);
  await env.drain();
  const r2 = await post();
  await env.drain();
  const [a, b] = [r1.json().runs[0], r2.json().runs[0]];
  const dedupeA = (await env.steps(a)).find(s => s.key === 'dedupe');
  const dedupeB = (await env.steps(b)).find(s => s.key === 'dedupe');
  assert.equal(dedupeA!.output.duplicate, false);
  assert.equal(dedupeB!.output.duplicate, true);
  assert.equal((await env.steps(a)).find(s => s.key === 'normalize')!.output.phone, '971507778888');
  assert.equal((await env.steps(a)).find(s => s.key === 'route')!.output.branch, 'nurture');
});
