import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { approvalToken } from '../src/engine/approvals.js';
import { buildServer } from '../src/server.js';
import { startDbListener } from '../src/triggers.js';
import { approveAll, deliver, mailParts, pendingApprovals, setup, start } from './helpers.js';

const sql = (e: { services: { db: { query: (q: string, p?: unknown[]) => Promise<unknown> } } }, q: string, p?: unknown[]) => e.services.db.query(q, p);

test('appointment-refill: cancellation → release → waitlist offers → first YES books, others told', async () => {
  const e = await setup({ workflows: ['appointment-refill'] });
  try {
    await sql(e, `INSERT INTO appointments (patient_name, phone, service, practitioner, starts_at) VALUES ('Laila Hassan', '+971 50 011 1111', 'physio follow-up', 'Dr. Lena', now() + interval '2 days')`);
    await sql(e, `INSERT INTO waitlist (patient_name, phone, service, created_at) VALUES ('Zara Ali', '971500333333', 'physio follow-up', now() - interval '3 days'), ('Omar Khan', '971500222222', 'physio follow-up', now() - interval '1 day'), ('Other', '971500999999', 'massage', now())`);
    e.fakes.ai.push(({ task }) => (task.startsWith('Classify') ? { label: 'cancel', confidence: 0.96, reason: 'cannot attend', language: null } : undefined));

    const d = await deliver(e, { channel: 'whatsapp', correlation: ['971500111111'], payload: { from: '971500111111', name: 'Laila', type: 'text', text: "So sorry, can't make Thursday 4pm" } });
    assert.equal(d.started.length, 1);
    const runId = d.started[0];
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting');

    assert.ok(e.fakes.sent('/conn/clinic/appointments/').some(r => r.method === 'PATCH' && r.body.status === 'cancelled'), 'slot released in clinic system');
    const offers = e.fakes.whatsappSent().filter(m => m.type === 'interactive');
    assert.deepEqual(offers.map(o => o.to).sort(), ['971500222222', '971500333333'], 'only matching waitlist patients offered');
    assert.match(offers[0].interactive.body.text, /physio follow-up slot just opened with Dr\. Lena/);

    // Zara says no first; the run keeps waiting. Omar says yes.
    await deliver(e, { channel: 'whatsapp', correlation: ['971500333333'], payload: { from: '971500333333', type: 'interactive', text: 'No thanks', button: 'No thanks' } });
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting');
    await deliver(e, { channel: 'whatsapp', correlation: ['971500222222'], payload: { from: '971500222222', type: 'interactive', text: 'Yes, book me', button: 'Yes, book me' } });
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');

    const booked = e.fakes.sent('/conn/clinic/appointments').find(r => r.method === 'POST');
    assert.equal(booked!.body.patient_name, 'Omar Khan');
    assert.equal(booked!.body.source, 'waitlist');
    const wa = e.fakes.whatsappSent();
    assert.ok(wa.some(m => m.to === '971500222222' && /You're booked/.test(m.text?.body)));
    assert.ok(wa.some(m => m.to === '971500333333' && /just been taken/.test(m.text?.body)));
  } finally { await e.close(); }
});

test('invoice-chaser: tone ladder per invoice, batch approval for firm letters, reconciliation', async () => {
  const e = await setup({ workflows: ['invoice-chaser'] });
  try {
    await sql(e, `INSERT INTO invoices (number, customer_name, email, phone, amount, due_date) VALUES
      ('1001', 'Ann Gentle', 'ann@example.com', null, 500, current_date - 3),
      ('1002', 'Daniel Clark', 'dan@example.com', '971500100200', 3480, current_date - 10),
      ('1003', 'Fiona Firm', 'fiona@example.com', null, 1200, current_date - 20),
      ('1004', 'Carl Call', 'carl@example.com', '971500100400', 9000, current_date - 45),
      ('1005', 'Paula Paid', 'paula@example.com', null, 250, current_date - 5),
      ('1006', 'Not Yet', 'n@example.com', null, 10, current_date + 5)`);
    e.fakes.routes.push(r => (r.path === '/conn/accounting/invoices/1005' ? { body: { status: 'paid' } } : r.path.startsWith('/conn/accounting/invoices/') && r.method === 'GET' ? { body: { status: 'open' } } : undefined));
    e.fakes.ai.push(({ task }) => (task.startsWith('Write a customer email') ? { subject: 'Invoice 1003 is now 20 days overdue', text: 'Dear Fiona, …' } : undefined));

    const runId = await start(e, 'invoice-chaser', 'daily', { scheduled_at: new Date().toISOString() });
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting', (await e.run(runId)).error ?? '');

    const subjects = await Promise.all(e.mail.messages.map(async m => (await mailParts(m.raw)).subject));
    assert.deepEqual(subjects, ['Invoice 1001 — friendly reminder']);
    assert.ok(e.fakes.whatsappSent().some(m => m.to === '971500100200' && /invoice 1002/.test(m.text.body)));
    const tasks = (await e.services.db.query(`SELECT title, assignee FROM tasks`)).rows;
    assert.equal(tasks.length, 1);
    assert.match(tasks[0].title, /Call Carl Call about 1004 \(45 days overdue\)/);
    assert.ok(e.fakes.sent('/conn/accounting/invoices/1005/mark-paid').length === 1, 'paid invoice reconciled');

    const [approval] = await pendingApprovals(e, runId);
    assert.equal(approval.title, '1 firm reminder(s) to send today');
    assert.equal(approval.detail[0]?.invoice ?? approval.detail.invoice, '1003');
    await approveAll(e, runId);
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    const firm = (await Promise.all(e.mail.messages.map(m => mailParts(m.raw)))).find(m => m.subject === 'Invoice 1003 is now 20 days overdue');
    assert.ok(firm, 'firm letter sent after approval');
    assert.equal(firm!.cc, 'accounts@demo.example');
  } finally { await e.close(); }
});

test('quote-followup: waits to day 2, sends a touch, a reply stops the cadence and books the job', async () => {
  const e = await setup({ workflows: ['quote-followup'] });
  try {
    const deal = await e.services.db.query(`INSERT INTO crm_records (object, stage, data) VALUES ('deal', 'quoted', '{"name":"Marcus"}') RETURNING id`) as { rows: { id: string }[] };
    e.fakes.ai.push(({ task }) => {
      if (task.startsWith('Write a customer email')) return { subject: 'Your bathroom refit quote', text: 'Hi Marcus, photos from Elm St attached…' };
      if (task.startsWith('Classify')) return { label: 'go_ahead', confidence: 0.94, reason: 'accepts', language: null };
    });
    const runId = await start(e, 'quote-followup', 'sent', { quote_number: 'Q-218', customer_name: 'Marcus Lee', email: 'Marcus@Example.com', amount: 4200, description: 'Bathroom refit', crm_id: deal.rows[0].id });
    await e.drain();
    assert.equal(e.mail.messages.length, 0, 'nothing sent before day 2');

    await e.advance('2d1h');
    await e.drain();
    assert.equal(e.mail.messages.length, 1);
    assert.equal((await mailParts(e.mail.messages[0].raw)).subject, 'Your bathroom refit quote');

    const d = await deliver(e, { channel: 'email', correlation: ['marcus@example.com'], payload: { from: 'marcus@example.com', subject: 'Re: Your bathroom refit quote', text: 'Yes please, go ahead!', message_id: '<reply-1@example.com>' } });
    assert.equal(d.resumed, runId);
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');

    const dealAfter = await e.services.db.query(`SELECT stage FROM crm_records WHERE id = $1`, [deal.rows[0].id]) as { rows: { stage: string }[] };
    assert.equal(dealAfter.rows[0].stage, 'won');
    const hold = await e.services.db.query(`SELECT kind, title FROM bookings`) as { rows: { kind: string; title: string }[] };
    assert.equal(hold.rows[0].kind, 'hold');
    const booking = await mailParts(e.mail.messages[1].raw);
    assert.match(booking.subject!, /You're booked in — deposit invoice for Q-218/);
    assert.equal(booking.inReplyTo, '<reply-1@example.com>');
    assert.ok(booking.hasPdf, 'deposit invoice PDF attached');
    assert.equal(e.mail.messages.length, 2, 'no further touches after the reply');
  } finally { await e.close(); }
});

test('admissions-overflow: extract → choose program → least-loaded counsellor → reply with consult times', async () => {
  const e = await setup({ workflows: ['admissions-overflow'] });
  try {
    await sql(e, `INSERT INTO programs (name, schedule, format, fee, audience) VALUES ('AI for Finance', 'weekends', 'hybrid', 2400, 'finance'), ('Data Analytics (evening)', 'evenings', 'online', 1900, 'working professionals')`);
    await sql(e, `INSERT INTO counsellors (key, name, email, specialty, open_leads) VALUES ('nadia', 'Nadia', 'nadia@example.com', 'banking and finance careers', 3), ('sam', 'Sam', 'sam@example.com', 'tech', 1)`);
    e.fakes.ai.push(({ task, input }) => {
      if (task.startsWith('Extract')) return { interest: 'data analytics', schedule: 'evenings', background: 'banking', budget: null };
      if (task.startsWith('Pick the best')) {
        assert.match(input, /\[1\] [\s\S]*Data Analytics \(evening\)/);
        return { choices: [{ index: 1, score: 0.92, reason: 'evening schedule fits a banker' }, { index: 0, score: 0.7, reason: 'finance angle' }] };
      }
      if (task.startsWith('Write a customer email')) return { subject: 'Data Analytics (evening) — a great fit', text: 'Hi Ahmed…' };
    });
    const d = await deliver(e, { channel: 'form', workflow: 'admissions-overflow', correlation: [], payload: { name: 'Ahmed Ali', email: 'Ahmed@Example.com', message: 'Interested in Data Analytics, I work in banking, evenings only' } });
    const runId = d.started[0];
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting');
    const steps = Object.fromEntries((await e.steps(runId)).map(s => [s.key, s]));
    assert.equal(steps.match.output.choice.name, 'Data Analytics (evening)');
    assert.equal(steps.assign.output.first.key, 'nadia', 'banking specialty wins over lower load');
    assert.equal(steps.slots.output.count, 3);
    const toAhmed = e.mail.messages.find(m => m.to.includes('ahmed@example.com'));
    assert.equal((await mailParts(toAhmed!.raw)).subject, 'Data Analytics (evening) — a great fit');
    assert.ok(e.mail.messages.some(m => m.to.includes('nadia@example.com')), 'counsellor briefed');

    await e.advance('49h');
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
  } finally { await e.close(); }
});

test('weekly-report: queries → aggregates → AI summary → PDF emailed', async () => {
  const e = await setup({ workflows: ['weekly-report'] });
  try {
    await sql(e, `INSERT INTO crm_records (object, data) SELECT 'lead', jsonb_build_object('source', CASE WHEN g % 2 = 0 THEN 'whatsapp' ELSE 'web' END) FROM generate_series(1, 38) g`);
    await sql(e, `INSERT INTO enrolments (program, amount) VALUES ('A', 1900), ('B', 2400)`);
    await sql(e, `INSERT INTO ad_spend (day, channel, amount, leads) VALUES (current_date - 1, 'meta', 1200, 18), (current_date - 2, 'google', 640, 20)`);
    e.fakes.ai.push(({ task }) => (task.startsWith('Summarise') ? { summary: '38 leads, 2 enrolments. Google is cheaper per lead; shift budget.', flags: [{ type: 'opportunity', detail: 'Google CPL $32 vs Meta $67' }] } : undefined));
    const runId = await start(e, 'weekly-report', 'cron', { scheduled_at: '2026-10-05T08:00:00Z' });
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    const agg = (await e.steps(runId)).find(s => s.key === 'aggregate')!.output;
    assert.equal(agg.leads, 38);
    assert.equal(agg.spend, 1840);
    assert.equal(agg.cost_per_lead, 48.42);
    assert.equal(agg.week, '2026-10-05');
    const mail = await mailParts(e.mail.messages[0].raw);
    assert.equal(mail.subject, 'Weekly recap — 38 leads, 2 enrolments');
    assert.ok(mail.hasPdf);
    assert.deepEqual(e.mail.messages[0].to.sort(), ['maya@example.com', 'rana@example.com']);
  } finally { await e.close(); }
});

test('failed-payment-rescue: Stripe webhook → retries on a ladder → ask for card → PAUSE pauses', async () => {
  const e = await setup({ workflows: ['failed-payment-rescue'] });
  const app = buildServer(e.services);
  try {
    await sql(e, `INSERT INTO members (name, phone, email, plan, stripe_customer) VALUES ('Sarah Kent', '971500444444', 'sarah@example.com', 'Gold', 'cus_1')`);
    e.fakes.routes.push(r => (r.path === '/conn/stripe/invoices/in_1/pay' ? { status: 402, body: { error: { message: 'Your card has expired.' } } } : undefined));

    const body = JSON.stringify({ id: 'evt_1', type: 'invoice.payment_failed', livemode: false, data: { object: { id: 'in_1', customer: 'cus_1', subscription: 'sub_1', hosted_invoice_url: 'https://pay.stripe.com/i/abc' } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'whsec_test').update(`${t}.${body}`).digest('hex');
    const bad = await app.inject({ method: 'POST', url: '/hooks/stripe', payload: body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=deadbeef` } });
    assert.equal(bad.statusCode, 400);
    const res = await app.inject({ method: 'POST', url: '/hooks/stripe', payload: body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` } });
    assert.equal(res.statusCode, 200);
    const runId = res.json().started[0];

    await e.drain();
    await e.advance('1h'); await e.drain();
    await e.advance('1d'); await e.drain();
    assert.equal(e.fakes.sent('/conn/stripe/invoices/in_1/pay').length, 3, 'three charge attempts on the ladder');
    assert.equal(e.fakes.sent('/conn/stripe/invoices/in_1/pay')[0].headers.authorization, 'Bearer sk_stripe_test');
    const ask = e.fakes.whatsappSent().find(m => m.to === '971500444444');
    assert.match(ask.text.body, /Gold membership didn't go through.*https:\/\/pay\.stripe\.com\/i\/abc/);

    await deliver(e, { channel: 'whatsapp', correlation: ['971500444444'], payload: { from: '971500444444', type: 'text', text: 'pause please' } });
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    const pause = e.fakes.sent('/conn/stripe/subscriptions/sub_1')[0];
    assert.equal(pause.raw.toString(), 'pause_collection%5Bbehavior%5D=void', 'Stripe form encoding');
    assert.ok(e.fakes.whatsappSent().some(m => m.to === '971500444444' && /paused for a month/.test(m.text.body)));
  } finally { await app.close(); await e.close(); }
});

test('review-harvester: db trigger via LISTEN/NOTIFY → ask → unhappy reply → manager approves an edited reply', async () => {
  const e = await setup({ workflows: ['review-harvester'] });
  const app = buildServer(e.services);
  const stopListen = startDbListener(e.services);
  try {
    await sql(e, `CREATE TRIGGER jobs_processly AFTER INSERT OR UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION processly_notify()`);
    await sql(e, `INSERT INTO jobs (customer_name, phone, service, technician) VALUES ('Fatima Rahman', '971500666666', 'AC service', 'Joe')`);
    await new Promise(r => setTimeout(r, 300)); // listener connects
    await sql(e, `UPDATE jobs SET status = 'completed', completed_at = now() WHERE customer_name = 'Fatima Rahman'`);
    let runId: string | undefined;
    for (let i = 0; i < 50 && !runId; i++) {
      await new Promise(r => setTimeout(r, 50));
      runId = ((await e.services.db.query(`SELECT id FROM runs WHERE workflow = 'review-harvester'`)).rows[0] as { id: string } | undefined)?.id;
    }
    assert.ok(runId, 'status change started a run (insert did not)');
    assert.equal((await e.services.db.query(`SELECT count(*)::int AS n FROM runs`)).rows[0].n, 1);

    await e.drain();
    assert.equal(e.fakes.whatsappSent().length, 0, 'waits a day first');
    await e.advance('24h'); await e.drain();
    assert.match(e.fakes.whatsappSent()[0].text.body, /how did Joe do, 1 to 5/);

    e.fakes.ai.push(({ task }) => {
      if (task.startsWith('Read the customer message')) return { sentiment: 'negative', tone: 'annoyed', urgency: 'high', rating: 2 };
      if (task.startsWith('Write a message')) return { text: 'So sorry Fatima…' };
    });
    await deliver(e, { channel: 'whatsapp', correlation: ['971500666666'], payload: { from: '971500666666', type: 'text', text: '2. He was late and left a mess' } });
    await e.drain();
    assert.ok(e.fakes.whatsappSent().some(m => m.to === '971500000001' && /rated job #1 .* 2★/.test(m.text.body)), 'manager alerted');

    const [approval] = await pendingApprovals(e, runId);
    assert.equal(approval.detail.draft, 'So sorry Fatima…');
    const unauth = await app.inject({ method: 'POST', url: `/api/approvals/${approval.id}`, payload: { decision: 'approved' } });
    assert.equal(unauth.statusCode, 401);
    const res = await app.inject({ method: 'POST', url: `/api/approvals/${approval.id}`, headers: { authorization: 'Bearer test-admin-token-123456' }, payload: { decision: 'approved', edits: { text: 'Fatima, that is not OK — Joe will come back tomorrow, free.' } } });
    assert.equal(res.statusCode, 200);
    await e.drain();
    const run = await e.run(runId!);
    assert.equal(run.status, 'completed', run.error ?? '');
    assert.equal(e.fakes.whatsappSent().filter(m => m.to === '971500666666').pop().text.body, 'Fatima, that is not OK — Joe will come back tomorrow, free.');
  } finally { stopListen(); await app.close(); await e.close(); }
});

test('catering-quote: email → extract → validate → price → PDF → approve by link → reply in thread', async () => {
  const e = await setup({ workflows: ['catering-quote'] });
  const app = buildServer(e.services);
  try {
    await sql(e, `INSERT INTO menu_packages (name, per_head, min_guests, max_guests, description) VALUES ('Festive Buffet', 41, 30, 150, 'Hot buffet with a vegetarian station'), ('Canapés', 28, 20, 200, 'Standing reception')`);
    const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    e.fakes.ai.push(({ task }) => {
      if (task.startsWith('Extract')) return { event_date: date, guests: 60, budget: 2500, dietary: '8 vegetarian', company: 'Northwind Ltd', venue: 'office' };
      if (task.startsWith('Pick the best')) return { choices: [{ index: 1, score: 0.9, reason: 'fits $41/head budget and has a veg station' }] };
      if (task.startsWith('Write a customer email')) return { subject: 'Your catering quote for 14 Dec', text: 'Hi Hana, attached…' };
    });
    const d = await deliver(e, { channel: 'email', correlation: ['hana@northwind.example'], idemKey: '<m1@nw>', payload: { from: 'hana@northwind.example', from_name: 'Hana', to: ['events@demo.example'], subject: 'Catering for 60', text: 'Office party 60 people, ~$2.5k, 8 veg', message_id: '<m1@nw>' } });
    const runId = d.started[0];
    await e.drain();
    const [approval] = await pendingApprovals(e, runId);
    assert.match(approval.title, /60 guests, \$2460/);
    assert.ok(e.fakes.whatsappSent().some(m => m.to === '971500000001' && m.text.body.includes(`/approvals/${approval.id}?t=`)), 'manager got the approval link');

    const t = approvalToken('test-hook-secret-123456', approval.id);
    assert.equal((await app.inject({ method: 'GET', url: `/approvals/${approval.id}?t=wrong` })).statusCode, 403);
    const page = await app.inject({ method: 'GET', url: `/approvals/${approval.id}?t=${t}` });
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /Festive Buffet/);
    const post = await app.inject({ method: 'POST', url: `/approvals/${approval.id}?t=${t}`, payload: 'decision=approved&note=looks+good', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(post.statusCode, 200);
    await e.drain();

    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    const mail = await mailParts(e.mail.messages.find(m => m.to.includes('hana@northwind.example'))!.raw);
    assert.equal(mail.subject, 'Your catering quote for 14 Dec');
    assert.equal(mail.inReplyTo, '<m1@nw>');
    assert.ok(mail.hasPdf);
    const deal = (await e.services.db.query(`SELECT data FROM crm_records WHERE object = 'deal'`)).rows[0] as { data: { amount: number; name: string } };
    assert.equal(deal.data.amount, 2460);
    assert.equal(deal.data.name, 'Northwind Ltd');
  } finally { await app.close(); await e.close(); }
});
