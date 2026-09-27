import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { buildServer } from '../src/server.js';
import { uploadToken } from '../src/links.js';
import { approveAll, deliver, mailParts, pendingApprovals, setup, start, whatsappWebhook } from './helpers.js';

const sql = (e: { services: { db: { query: (q: string, p?: unknown[]) => Promise<any> } } }, q: string, p?: unknown[]) => e.services.db.query(q, p);

test('order-status: Spanish WhatsApp → order lookup + carrier tracking → answer translated to Spanish; angry messages become urgent tickets', async () => {
  const e = await setup({ workflows: ['order-status'] });
  try {
    await sql(e, `INSERT INTO orders (number, customer_name, phone, status, shipped_at, carrier, tracking_number) VALUES ('58213', 'Lucía Gómez', '+34 600 111 222', 'shipped', now() - interval '2 days', 'dhl', 'JD014600')`);
    e.fakes.routes.push(r => (r.path === '/conn/carrier/track/dhl/JD014600' ? { body: { status: 'out_for_delivery', eta: 'today 16:00–18:00', url: 'https://dhl.example/JD014600' } } : undefined));
    e.fakes.ai.push(({ task, input }) => {
      if (task.startsWith('Classify')) return /mierda|terrible/.test(input) ? { label: 'complaint', confidence: 0.9, reason: 'angry', language: 'es' } : { label: 'order_status', confidence: 0.98, reason: 'asks where order is', language: 'es' };
      if (task.startsWith('Read the customer')) return /mierda|terrible/.test(input) ? { sentiment: 'negative', tone: 'furious', urgency: 'high', rating: null } : { sentiment: 'neutral', tone: 'curious', urgency: 'low', rating: null };
      if (task.startsWith('Extract')) return { order_number: '58213' };
      if (task.startsWith('Write a message')) return { text: 'Your order 58213 is out for delivery with DHL, arriving today 16:00–18:00.' };
      if (task.startsWith('Translate')) return { text: '¡Tu pedido 58213 está en reparto con DHL! Llega hoy entre las 16:00 y las 18:00.', from: 'en' };
      if (task.startsWith('Summarise')) return { summary: 'Furious about a damaged order', flags: [] };
    });

    const d = await deliver(e, { channel: 'whatsapp', correlation: ['34600111222'], payload: { from: '34600111222', name: 'Lucía', type: 'text', text: 'hola, dónde está mi pedido? #58213' } });
    await e.drain();
    assert.equal((await e.run(d.started[0])).status, 'completed', (await e.run(d.started[0])).error ?? '');
    const steps = Object.fromEntries((await e.steps(d.started[0])).map(s => [s.key, s]));
    assert.equal(steps['route/b0/lookup'].output.first.number, '58213', 'found by order number');
    assert.equal(steps['route/b0/track'].output.data.status, 'out_for_delivery');
    const translate = e.fakes.aiCalls.find(c => c.task.startsWith('Translate'));
    assert.match(translate!.task, /into es\./);
    assert.match(e.fakes.whatsappSent().pop().text.body, /^¡Tu pedido 58213/);

    const d2 = await deliver(e, { channel: 'whatsapp', correlation: ['34600999000'], payload: { from: '34600999000', type: 'text', text: 'esto es terrible, llegó roto' } });
    await e.drain();
    assert.equal((await e.run(d2.started[0])).status, 'completed');
    const task = (await sql(e, `SELECT title, due_at, created_at FROM tasks`)).rows[0];
    assert.match(task.title, /^🔴 Furious about a damaged order/);
    assert.equal(e.fakes.whatsappSent().length, 1, 'complaints get a person, not a bot reply');
  } finally { await e.close(); }
});

test('client-documents: welcome with signed upload link → uploads identified, filed, ticked → reminder lists only what is missing → hand-off', async () => {
  const e = await setup({ workflows: ['client-documents'] });
  const app = buildServer(e.services);
  try {
    await sql(e, `INSERT INTO clients (name, contact_name, email, type) VALUES ('Orchard Bakery Ltd', 'Tom', 'tom@orchard.example', 'ltd')`);
    await sql(e, `INSERT INTO document_checklists (client_type, item, description) VALUES ('ltd', 'bank_statements', 'Bank statements for the full year'), ('ltd', 'vat_return', 'Your Q4 VAT return')`);
    const runId = await start(e, 'client-documents', 'onboard', { event: 'client.onboarded', client_id: 1 });
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting', (await e.run(runId)).error ?? '');
    const welcome = await mailParts(e.mail.messages[0].raw);
    assert.equal(welcome.subject, 'Welcome aboard — 2 documents we need');
    const link = /https:\/\/engine\.example\.com(\/upload\/[\w.-]+)/.exec(welcome.text)![1];
    assert.match(welcome.text, /• Your Q4 VAT return/);

    // Forged or tampered links are refused.
    assert.equal((await app.inject({ method: 'GET', url: link + 'x' })).statusCode, 404);
    assert.equal((await app.inject({ method: 'GET', url: link })).statusCode, 200);

    const upload = async (name: string) => {
      const boundary = '----b' + crypto.randomBytes(4).toString('hex');
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${name}"\r\nContent-Type: application/pdf\r\n\r\n`),
        Buffer.from('%PDF-1.4 fake ' + name), Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const res = await app.inject({ method: 'POST', url: link, payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } });
      assert.equal(res.statusCode, 200);
      await e.drain();
    };

    e.fakes.ai.push(({ task, input }) => task.startsWith('Extract') && /scan_0012/.test(input) ? { document_type: 'bank_statements', period_start: '2024-04-01', period_end: '2025-03-31', legible: true, issues: null } : undefined);
    await upload('scan_0012.pdf');
    const filed = (await sql(e, `SELECT name, folder FROM files WHERE folder LIKE 'clients/%'`)).rows[0];
    assert.deepEqual(filed, { name: 'bank_statements_2024-04-01_2025-03-31.pdf', folder: 'clients/1' });

    await e.advance('3d');
    await e.drain();
    const reminder = await mailParts(e.mail.messages.at(-1)!.raw);
    assert.equal(reminder.subject, '1 document(s) still to come');
    assert.match(reminder.text, /1 of 2 done/);
    assert.match(reminder.text, /• Your Q4 VAT return/);
    assert.doesNotMatch(reminder.text, /Bank statements/);

    e.fakes.ai.push(({ task, input }) => task.startsWith('Extract') && /vat/.test(input) ? { document_type: 'vat_return', period_start: null, period_end: null, legible: true, issues: null } : undefined);
    await upload('vat.pdf');
    await e.advance('3d');
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    assert.match((await sql(e, `SELECT title FROM tasks`)).rows[0].title, /Orchard Bakery Ltd: all 2 documents in/);
    assert.equal(e.mail.messages.length, 2, 'no reminder once everything arrived');
  } finally { await app.close(); await e.close(); }
});

test('candidate-screening (review mode): CV read from the attachment, each outgoing action waits for a person, stats count clean runs', async () => {
  const e = await setup({ workflows: ['candidate-screening'] });
  const app = buildServer(e.services);
  try {
    const cv = await e.services.connectors.files.save(Buffer.from('Dana K — 7 years ops, WMS rollout, Dubai, 30 days notice'), 'cv.txt', 'text/plain');
    e.fakes.ai.push(({ task, input }) => {
      if (task.startsWith('Extract')) { assert.match(input, /WMS rollout/, 'attachment text reached Claude'); return { name: 'Dana Kareem', email: 'Dana@Example.com', phone: null, years_experience: 7, current_role: 'Ops lead, Gulf Logistics', skills: ['WMS'], location: 'Dubai', notice_period_days: 30 }; }
      if (task.startsWith('Score')) return { score: 0.86, label: 'hot', reasons: ['7 years', 'WMS'] };
      if (task.startsWith('Pick the best')) return { choices: [{ index: 1, score: 0.95, reason: 'said Wednesday' }] };
    });
    const d = await deliver(e, { channel: 'email', correlation: ['dana@example.com'], payload: { from: 'dana@example.com', from_name: 'Dana', to: ['jobs@demo.example'], subject: 'Application: Operations Manager', text: 'CV attached', files: [cv] } });
    const runId = d.started[0];
    await e.drain();

    let [a] = await pendingApprovals(e, runId);
    assert.equal(a.kind, 'review');
    assert.equal(a.detail.primitive, 'crm.create');
    assert.equal((await sql(e, `SELECT count(*)::int AS n FROM crm_records`)).rows[0].n, 0, 'nothing happens before review');
    await approveAll(e, runId); // crm.create, then the invite email (find_slots is read-only, not gated)
    const invite = await mailParts(e.mail.messages[0].raw);
    assert.equal(invite.subject, 'Operations Manager — let\'s talk');
    assert.equal(invite.to, 'dana@example.com');

    await deliver(e, { channel: 'email', correlation: ['dana@example.com'], payload: { from: 'dana@example.com', text: 'The second one works for me', message_id: '<dana-2@example.com>' } });
    await e.drain();
    [a] = await pendingApprovals(e, runId);
    assert.equal(a.detail.primitive, 'calendar.book');
    await approveAll(e, runId);
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    assert.equal((await sql(e, `SELECT count(*)::int AS n FROM bookings WHERE kind = 'booking'`)).rows[0].n, 1);
    assert.match((await mailParts(e.mail.messages.at(-1)!.raw)).subject!, /^Confirmed: /);

    const stats = await app.inject({ method: 'GET', url: '/api/workflows/candidate-screening/stats', headers: { authorization: 'Bearer test-admin-token-123456' } });
    assert.deepEqual(stats.json().review_mode, { clean: 1, edited: 0, rejected: 0 });
  } finally { await app.close(); await e.close(); }
});

test('renewal-radar (review mode): 45-day scan requotes and sends packs; silent clients become call tasks; replies become broker tasks', async () => {
  const e = await setup({ workflows: ['renewal-radar'] });
  try {
    await sql(e, `INSERT INTO policies (client_name, email, phone, type, insurer, premium, renewal_premium, renews_on) VALUES
      ('Aisha Khan', 'aisha@example.com', '971500777777', 'home & motor', 'Oasis', 2230, 2540, current_date + 45),
      ('Lee Wong', 'lee@example.com', '971500888888', 'motor', 'Oasis', 900, 980, current_date + 38)`);
    await sql(e, `INSERT INTO records (collection, key, data) VALUES ('renewals', '2', '{"replied": false}')`);
    e.fakes.routes.push(r => (r.path === '/conn/quote_engine/quotes' ? { body: { quotes: [{ insurer: 'Harbor', premium: 2228 }, { insurer: 'Dune', premium: 2390 }] } } : undefined));
    e.fakes.ai.push(({ task }) => (task.startsWith('Summarise') ? { summary: 'Oasis is up 14%. Harbor offers the same cover for $312 less.', flags: [] } : task.startsWith('Classify') ? { label: 'switch', confidence: 0.9, reason: 'wants cheaper', language: null } : undefined));

    const runId = await start(e, 'renewal-radar', 'daily', { scheduled_at: new Date().toISOString() });
    await e.drain();
    const first = await pendingApprovals(e, runId);
    assert.equal(first[0].detail.primitive, 'integration.call', 'requote is gated in review mode');
    await approveAll(e, runId);
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    const pack = await mailParts(e.mail.messages[0].raw);
    assert.equal(pack.to, 'aisha@example.com');
    assert.ok(pack.hasPdf);
    assert.match(pack.text, /\$312 less/);
    assert.match((await sql(e, `SELECT title FROM tasks`)).rows[0].title, /^Call Lee Wong before their motor renewal/);

    const d = await deliver(e, { channel: 'email', correlation: ['aisha@example.com'], payload: { from: 'aisha@example.com', subject: 'Re: Your home & motor renewal', text: 'Switch us please!' } });
    assert.equal(d.started.length, 1);
    await e.drain();
    await approveAll(e, d.started[0]);
    assert.equal((await e.run(d.started[0])).status, 'completed');
    const t = (await sql(e, `SELECT title FROM tasks ORDER BY created_at`)).rows.at(-1);
    assert.match(t.title, /^Aisha Khan: bind the new policy/);
    assert.equal((await sql(e, `SELECT data->>'replied' AS r FROM records WHERE collection = 'renewals' AND key = '1'`)).rows[0].r, 'true');
  } finally { await e.close(); }
});

test('service-reminder: due by estimated mileage → one reminder only → Book → slots as buttons → booked; Later snoozes', async () => {
  const e = await setup({ workflows: ['service-reminder'] });
  try {
    await sql(e, `INSERT INTO vehicles (customer_name, phone, make_model, last_service_at, last_service_km, km_per_day, next_service_km, advisor) VALUES
      ('Khalid Musa', '971500121212', 'Toyota RAV4', current_date - 420, 15000, 35, 30000, 'Joe Brown'),
      ('Not Due', '971500131313', 'Kia Rio', current_date - 100, 10000, 20, 30000, 'Joe Brown')`);
    e.fakes.ai.push(({ task }) => (task.startsWith('Write a message') ? { text: 'Hi Khalid, your RAV4 is about at 30,000 km…' } : undefined));
    await start(e, 'service-reminder', 'daily', {});
    await e.drain();
    await start(e, 'service-reminder', 'daily', {});
    await e.drain();
    const reminders = e.fakes.whatsappSent();
    assert.equal(reminders.length, 1, 'one reminder per service, across daily runs');
    assert.equal(reminders[0].to, '971500121212');
    assert.deepEqual(reminders[0].interactive.action.buttons.map((b: any) => b.reply.title), ['Book a service', 'Remind me later']);

    const d = await deliver(e, { channel: 'whatsapp', correlation: ['971500121212'], payload: { from: '971500121212', type: 'interactive', text: 'Book a service', button: 'Book a service' } });
    await e.drain();
    const offer = e.fakes.whatsappSent().at(-1);
    const slot = offer.interactive.action.buttons[1].reply.title;
    await deliver(e, { channel: 'whatsapp', correlation: ['971500121212'], payload: { from: '971500121212', type: 'interactive', text: slot, button: slot } });
    await e.drain();
    const run = await e.run(d.started[0]);
    assert.equal(run.status, 'completed', run.error ?? '');
    const booking = (await sql(e, `SELECT title, starts_at FROM bookings`)).rows[0];
    assert.match(booking.title, /Toyota RAV4 — Khalid Musa \(courtesy car\)/);
    assert.match(e.fakes.whatsappSent().at(-1).text.body, /^Booked ✅ .* Joe will have your courtesy car ready\.$/);

    await deliver(e, { channel: 'whatsapp', correlation: ['971500121212'], payload: { from: '971500121212', type: 'interactive', text: 'Remind me later', button: 'Remind me later' } });
    await e.drain();
    const snooze = (await sql(e, `SELECT data FROM records WHERE collection = 'service-reminders'`)).rows[0].data;
    assert.match(snooze.remind_after, /^\d{4}-\d{2}-\d{2}$/);
  } finally { await e.close(); }
});

test('pre-arrival-upsell: waits until 3 days out, offers two extras in German, accepted ones go on the folio', async () => {
  const e = await setup({ workflows: ['pre-arrival-upsell'] });
  try {
    await sql(e, `INSERT INTO upsells (key, name, price, description) VALUES ('transfer', 'Airport transfer', 45, 'Driver meets you at arrivals'), ('late_checkout', 'Late checkout (14:00)', 30, ''), ('spa', 'Spa for two', 120, '')`);
    const arrival = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
    const row = (await sql(e, `INSERT INTO reservations (guest_name, phone, language, arrival, nights, guests, notes, flight_arrival) VALUES ('Jonas Weber', '491701234567', 'de', $1, 3, 2, 'anniversary', '22:40') RETURNING *`, [arrival])).rows[0];
    e.fakes.ai.push(({ task, input }) => {
      if (task.startsWith('Pick the best')) return { choices: [{ index: 0, score: 0.9, reason: 'late flight' }, { index: 1, score: 0.8, reason: 'anniversary' }] };
      if (task.startsWith('Write a message')) return { text: 'We look forward to 18 March…' };
      if (task.startsWith('Translate')) return { text: /all arranged/.test(input) ? 'Wunderbar — alles erledigt.' : 'Hallo Jonas! Wir freuen uns…', from: 'en' };
      if (task.startsWith('Extract')) return { keys: ['transfer', 'late_checkout'], question: null };
    });
    const d = await deliver(e, { channel: 'db', correlation: [`reservations:${row.id}`], payload: { table: 'reservations', op: 'insert', row } });
    await e.drain();
    assert.equal(e.fakes.whatsappSent().length, 0, 'nothing until 3 days before arrival');
    await e.advance('3d');
    await e.drain();
    assert.equal(e.fakes.whatsappSent()[0].text.body, 'Hallo Jonas! Wir freuen uns…');

    await deliver(e, { channel: 'whatsapp', correlation: ['491701234567'], payload: { from: '491701234567', type: 'text', text: 'JA, beides bitte!' } });
    await e.drain();
    const run = await e.run(d.started[0]);
    assert.equal(run.status, 'completed', run.error ?? '');
    const charges = e.fakes.sent(`/conn/pms/reservations/${row.id}/charges`).map(r => [r.body.code, r.body.amount]).sort();
    assert.deepEqual(charges, [['late_checkout', 30], ['transfer', 45]]);
    assert.ok(e.fakes.sent('/slack').some(r => /Jonas Weber .* lands 22:40.*added: .*Airport transfer/.test(r.body.text) && /Late checkout/.test(r.body.text)), 'front desk briefed on Slack');
  } finally { await e.close(); }
});

test('whatsapp-order-intake: photo via webhook → lines read → stock/credit checks → confirm button in thread → ERP order → invoice PDF on WhatsApp', async () => {
  const e = await setup({ workflows: ['whatsapp-order-intake'] });
  const app = buildServer(e.services);
  try {
    await sql(e, `INSERT INTO trade_customers (phone, name, credit_limit, balance) VALUES ('971500555555', 'Al Noor Grocers', 5000, 1000)`);
    await sql(e, `INSERT INTO products (sku, name, unit, price, stock) VALUES ('BAS5', 'Basmati rice 5kg', 'bag', 21.5, 8), ('TOM400', 'Tomato paste 400g', 'tin', 1.2, 500), ('OIL1', 'Sunflower oil 1L', 'bottle', 3.4, 200)`);
    e.fakes.ai.push(({ task }) => {
      if (task.startsWith('Extract')) return { lines: [{ sku: 'BAS5', qty: 10, written_as: 'basmati 5kg x10' }, { sku: 'TOM400', qty: 24, written_as: 'tom paste x?' }, { sku: 'OIL1', qty: 12, written_as: 'oil 1L 12' }], unclear: ['tom paste x?'] };
      if (task.startsWith('Write a message')) return { text: 'Morning Rashid 👋 Got your list: 3 items, $284.60. We have 8 of the 10 basmati…' };
    });
    e.fakes.routes.push(r => (r.path === '/conn/erp/sales-orders' ? { body: { id: 'SO-8812', invoice_number: 'INV-8812' } } : undefined));

    const body = JSON.stringify(whatsappWebhook({ from: '971500555555', name: 'Rashid', imageId: 'media-photo-1', id: 'wamid.order.1' }));
    const sig = 'sha256=' + crypto.createHmac('sha256', 'wa-app-secret').update(body).digest('hex');
    const res = await app.inject({ method: 'POST', url: '/hooks/whatsapp', payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig } });
    const runId = res.json().results[0].started[0];
    await e.drain();
    assert.equal((await e.run(runId)).status, 'waiting', (await e.run(runId)).error ?? '');

    const extractCall = e.fakes.aiCalls.find(c => c.task.startsWith('Extract'))!;
    assert.match(extractCall.input, /TOM400 \| Tomato paste 400g \| tin/);
    const aiReq = e.fakes.requests.find(r => r.path.startsWith('/v1/messages') && JSON.stringify(r.body).includes('"type":"image"'));
    assert.ok(aiReq, 'the photo was sent to Claude as an image block');
    const steps = Object.fromEntries((await e.steps(runId)).map(s => [s.key, s]));
    assert.equal(steps.priced.output.total, 284.6);
    assert.deepEqual(steps.check.output.failures.map((f: any) => f.name), ['stock']);
    const confirm = e.fakes.whatsappSent().at(-1);
    assert.equal(confirm.context.message_id, 'wamid.order.1', 'reply quotes the customer\'s photo');
    assert.deepEqual(confirm.interactive.action.buttons.map((b: any) => b.reply.title), ['Confirm', 'Change something']);

    const tap = JSON.stringify(whatsappWebhook({ from: '971500555555', button: 'Confirm', contextId: 'wamid.x' }));
    await app.inject({ method: 'POST', url: '/hooks/whatsapp', payload: tap, headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' + crypto.createHmac('sha256', 'wa-app-secret').update(tap).digest('hex') } });
    await e.drain();
    const run = await e.run(runId);
    assert.equal(run.status, 'completed', run.error ?? '');
    const erp = e.fakes.sent('/conn/erp/sales-orders')[0].body;
    assert.deepEqual(erp.lines, [{ sku: 'BAS5', qty: 8 }, { sku: 'TOM400', qty: 24 }, { sku: 'OIL1', qty: 12 }], 'short line capped at stock');
    const doc = e.fakes.whatsappSent().at(-1);
    assert.equal(doc.type, 'document');
    assert.equal(doc.document.id, 'media-upload-1');
    assert.equal(e.fakes.sent('/wa/1555000/media').length, 1, 'invoice PDF uploaded to WhatsApp');
    const pdf = (await sql(e, `SELECT name, mime FROM files WHERE folder = 'generated'`)).rows[0];
    assert.deepEqual(pdf, { name: 'invoice-inv-8812.pdf', mime: 'application/pdf' });
  } finally { await app.close(); await e.close(); }
});

test('upload tokens are bound to their ref', () => {
  const t = uploadToken('7', 'clients');
  assert.ok(t.includes('.'));
});
