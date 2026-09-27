import crypto from 'node:crypto';
import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import formbody from '@fastify/formbody';
import multipart from '@fastify/multipart';
import { ApprovalConflict, approvalLink, decideApproval, verifyApprovalToken } from './engine/approvals.js';
import { deliverEvent, startRun } from './engine/events.js';
import type { Services } from './engine/types.js';
import { parseWhatsAppWebhook } from './connectors/whatsapp.js';
import { readUploadToken } from './links.js';

declare module 'fastify' { interface FastifyRequest { rawBody?: Buffer } }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{color-scheme:light dark;--bg:#f8fafc;--card:#fff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--accent:#4f46e5}
@media (prefers-color-scheme:dark){:root{--bg:#0b1020;--card:#131a2e;--ink:#e2e8f0;--muted:#94a3b8;--line:#243049;--accent:#818cf8}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px}
h1{font-size:20px;margin:0 0 6px}p{color:var(--muted);margin:0 0 14px}pre{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;font-size:13px;white-space:pre-wrap;word-break:break-word}
textarea,input[type=file]{width:100%;box-sizing:border-box;margin:6px 0 14px;font:inherit}textarea{min-height:70px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--bg);color:var(--ink)}
.row{display:flex;gap:10px;flex-wrap:wrap}button{font:inherit;font-weight:600;border-radius:10px;padding:11px 18px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}.badge{display:inline-block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent)}
</style></head><body><main><div class="card">${body}</div></main></body></html>`;

export function buildServer(services: Services) {
  const { config, project, db, connectors } = services;
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024, trustProxy: true });

  // Keep the raw body for signature checks (WhatsApp, Stripe, HMAC webhooks).
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as FastifyRequest).rawBody = body as Buffer;
    try { done(null, (body as Buffer).length ? JSON.parse((body as Buffer).toString('utf8')) : {}); }
    catch { const e = new Error('invalid JSON') as Error & { statusCode: number }; e.statusCode = 400; done(e, undefined); }
  });
  app.register(formbody);
  app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 10 } });

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) console.error('[http]', err);
    reply.status(status).send({ error: status >= 500 ? 'internal error' : err.message });
  });

  const admin = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!token || !safeEqual(token, config.ADMIN_TOKEN)) return reply.status(401).send({ error: 'unauthorized' });
  };

  app.get('/health', async () => {
    await db.query('SELECT 1');
    return { ok: true, business: project.business.name, workflows: [...project.workflows.keys()] };
  });

  // ------------------------------------------------------------------ hooks

  const cors = (reply: FastifyReply) => reply.header('Access-Control-Allow-Origin', '*').header('Access-Control-Allow-Headers', 'Content-Type').header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  app.options('/hooks/form/:workflow', async (_req, reply) => cors(reply).status(204).send());
  app.post<{ Params: { workflow: string }; Body: Record<string, unknown> }>('/hooks/form/:workflow', async (req, reply) => {
    cors(reply);
    const wf = project.workflows.get(req.params.workflow);
    if (!wf || !wf.triggers.some(t => t.use === 'trigger.form')) return reply.status(404).send({ error: 'no such form workflow' });
    const { _redirect, _gotcha, ...fields } = (req.body ?? {}) as Record<string, unknown>;
    if (_gotcha) return reply.status(200).send({ ok: true }); // honeypot: bots fill hidden fields
    const d = await deliverEvent(services, {
      channel: 'form', workflow: wf.workflow, payload: fields,
      correlation: [fields.email, fields.phone].filter(Boolean).map(v => String(v).trim().toLowerCase()),
    });
    if (typeof _redirect === 'string' && /^https?:\/\//.test(_redirect)) return reply.redirect(_redirect, 303);
    return { ok: true, runs: d.started };
  });

  const hookAuth = (req: FastifyRequest) => {
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (bearer && safeEqual(bearer, config.HOOK_SECRET)) return true;
    const sig = String(req.headers['x-processly-signature'] ?? '');
    if (sig && req.rawBody) return safeEqual(sig, 'sha256=' + crypto.createHmac('sha256', config.HOOK_SECRET).update(req.rawBody).digest('hex'));
    return false;
  };
  const apiHook = async (req: FastifyRequest<{ Params: { workflow?: string }; Body: Record<string, unknown> }>, reply: FastifyReply) => {
    if (!hookAuth(req)) return reply.status(401).send({ error: 'bad or missing signature' });
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (req.params.workflow && !project.workflows.has(req.params.workflow)) return reply.status(404).send({ error: 'unknown workflow' });
    const correlation = ([] as unknown[]).concat(body.correlation ?? []).map(String);
    const d = await deliverEvent(services, {
      channel: 'api', workflow: req.params.workflow, correlation,
      idemKey: req.headers['idempotency-key'] ? String(req.headers['idempotency-key']) : undefined,
      payload: { ...body, event: body.event ?? (req.query as Record<string, string>).event ?? null },
    });
    return { ok: true, ...d };
  };
  app.post('/hooks/api', apiHook);
  app.post('/hooks/api/:workflow', apiHook);

  app.post('/hooks/stripe', async (req, reply) => {
    const secret = config.STRIPE_WEBHOOK_SECRET;
    if (!secret) return reply.status(404).send({ error: 'stripe webhooks not configured' });
    const header = String(req.headers['stripe-signature'] ?? '');
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]));
    const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${req.rawBody?.toString('utf8') ?? ''}`).digest('hex');
    const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
    const valid = header.split(',').filter(p => p.startsWith('v1=')).some(p => safeEqual(p.slice(3), expected));
    if (!fresh || !valid) return reply.status(400).send({ error: 'bad signature' });
    const e = req.body as { id: string; type: string; data: { object: Record<string, unknown> }; livemode: boolean };
    const obj = e.data?.object ?? {};
    const d = await deliverEvent(services, {
      channel: 'api', idemKey: e.id, correlation: [obj.customer, obj.id].filter(Boolean).map(String),
      payload: { event: e.type, stripe_event_id: e.id, livemode: e.livemode, object: obj },
    });
    return { received: true, ...d };
  });

  app.get('/hooks/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && config.WHATSAPP_VERIFY_TOKEN && q['hub.verify_token'] === config.WHATSAPP_VERIFY_TOKEN) return reply.type('text/plain').send(q['hub.challenge']);
    return reply.status(403).send('forbidden');
  });
  app.post('/hooks/whatsapp', async (req, reply) => {
    if (!connectors.whatsapp.verifySignature(req.rawBody ?? Buffer.alloc(0), req.headers['x-hub-signature-256'] as string | undefined)) {
      return reply.status(401).send({ error: 'bad signature' });
    }
    const results = [];
    for (const m of parseWhatsAppWebhook(req.body)) {
      let file = null;
      if (m.media_id) {
        const media = await connectors.whatsapp.downloadMedia(m.media_id);
        const ext = media.mime.split('/')[1]?.split(';')[0] ?? 'bin';
        file = await connectors.files.save(media.data, m.filename ?? `whatsapp-${m.message_id}.${ext}`, media.mime, { folder: 'whatsapp', meta: { from: m.from } });
      }
      results.push(await deliverEvent(services, {
        channel: 'whatsapp', idemKey: m.message_id,
        correlation: [m.from, m.context_id].filter(Boolean) as string[],
        payload: { ...m, file, files: file ? [file] : [] },
      }));
    }
    return { ok: true, results };
  });

  // Customer-facing upload page from $uploadLink(ref, folder)
  app.get<{ Params: { token: string } }>('/upload/:token', async (req, reply) => {
    const t = readUploadToken(req.params.token);
    if (!t) return reply.status(404).type('text/html').send(page('Link expired', '<h1>This link isn\'t valid</h1><p>Ask us for a new one.</p>'));
    return reply.type('text/html').send(page(`Upload to ${project.business.name}`, `
      <span class="badge">${esc(project.business.name)}</span><h1>Upload your documents</h1>
      <p>PDFs and phone photos are fine. You can come back to this link any time.</p>
      <form method="post" enctype="multipart/form-data"><input type="file" name="files" multiple required>
      <textarea name="note" placeholder="Anything we should know? (optional)"></textarea>
      <button class="primary" type="submit">Upload</button></form>`));
  });
  app.post<{ Params: { token: string } }>('/upload/:token', async (req, reply) => {
    const t = readUploadToken(req.params.token);
    if (!t) return reply.status(404).send({ error: 'invalid link' });
    const saved = [];
    let note = '';
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const data = await part.toBuffer();
        if (data.length) saved.push(await connectors.files.save(data, part.filename, part.mimetype, { folder: t.folder, meta: { ref: t.ref } }));
      } else if (part.fieldname === 'note') note = String(part.value ?? '');
    }
    for (const file of saved) {
      await deliverEvent(services, { channel: 'file', correlation: [t.ref], payload: { ref: t.ref, folder: t.folder, file, note } });
    }
    return reply.type('text/html').send(page('Thanks', `<h1>Got ${saved.length} file${saved.length === 1 ? '' : 's'} — thank you.</h1><p>We'll be in touch if anything else is needed.</p>`));
  });

  // ------------------------------------------------------ approvals (links)

  const loadApproval = async (id: string) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const { rows } = await db.query(`SELECT a.*, r.workflow FROM approvals a JOIN runs r ON r.id = a.run_id WHERE a.id = $1`, [id]);
    return rows[0] ?? null;
  };
  app.get<{ Params: { id: string }; Querystring: { t?: string } }>('/approvals/:id', async (req, reply) => {
    if (!verifyApprovalToken(config.HOOK_SECRET, req.params.id, req.query.t ?? '')) return reply.status(403).type('text/html').send(page('Forbidden', '<h1>Link not valid</h1>'));
    const a = await loadApproval(req.params.id);
    if (!a) return reply.status(404).type('text/html').send(page('Not found', '<h1>Approval not found</h1>'));
    const decided = a.status !== 'pending';
    return reply.type('text/html').send(page(a.title, `
      <span class="badge">${esc(a.workflow)} · ${esc(a.kind === 'review' ? 'review mode' : 'approval')}</span>
      <h1>${esc(a.title)}</h1><p>Requested ${esc(new Date(a.created_at).toUTCString())}${a.expires_at ? ` · expires ${esc(new Date(a.expires_at).toUTCString())}` : ''}</p>
      <pre>${esc(JSON.stringify(a.detail, null, 2))}</pre>
      ${decided ? `<p><b>${esc(a.status)}</b>${a.decided_by ? ` by ${esc(a.decided_by)}` : ''}${a.note ? `: ${esc(a.note)}` : ''}</p>` : `
      <form method="post"><textarea name="note" placeholder="Note (optional)"></textarea>
      <div class="row"><button class="primary" name="decision" value="approved">Approve</button><button name="decision" value="rejected">Reject</button></div></form>`}`));
  });
  app.post<{ Params: { id: string }; Querystring: { t?: string }; Body: { decision?: string; note?: string } }>('/approvals/:id', async (req, reply) => {
    if (!verifyApprovalToken(config.HOOK_SECRET, req.params.id, req.query.t ?? '')) return reply.status(403).send({ error: 'forbidden' });
    const decision = req.body?.decision === 'approved' ? 'approved' : req.body?.decision === 'rejected' ? 'rejected' : null;
    if (!decision) return reply.status(400).send({ error: 'decision must be approved or rejected' });
    try {
      await decideApproval(db, req.params.id, { decision, by: 'link', note: req.body?.note || undefined });
    } catch (err) {
      if (err instanceof ApprovalConflict) return reply.status(409).type('text/html').send(page('Already decided', '<h1>Someone already decided this one.</h1>'));
      throw err;
    }
    return reply.type('text/html').send(page('Done', `<h1>${decision === 'approved' ? 'Approved' : 'Rejected'} ✓</h1><p>The workflow has been told.</p>`));
  });

  // -------------------------------------------------------------- admin API

  app.register(async api => {
    api.addHook('onRequest', admin);

    api.get('/api/workflows', async () => [...project.workflows.values()].map(wf => ({
      workflow: wf.workflow, version: wf.version, mode: wf.mode, description: wf.description ?? null,
      triggers: wf.triggers.map(t => ({ id: t.id, use: t.use })), steps: wf.steps.length,
    })));

    api.get<{ Params: { name: string } }>('/api/workflows/:name', async (req, reply) => project.workflows.get(req.params.name) ?? reply.status(404).send({ error: 'unknown workflow' }));

    // Promotion evidence for review → auto: how many review-mode runs went through untouched.
    api.get<{ Params: { name: string } }>('/api/workflows/:name/stats', async (req, reply) => {
      const wf = project.workflows.get(req.params.name);
      if (!wf) return reply.status(404).send({ error: 'unknown workflow' });
      const runs = await db.query(`SELECT status, count(*)::int AS n FROM runs WHERE workflow = $1 AND version = $2 GROUP BY status`, [wf.workflow, wf.version]);
      const review = await db.query(
        `SELECT count(*) FILTER (WHERE r.status = 'completed' AND NOT EXISTS (
                  SELECT 1 FROM approvals a WHERE a.run_id = r.id AND a.kind = 'review' AND (a.status <> 'approved' OR a.edits IS NOT NULL)))::int AS clean,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM approvals a WHERE a.run_id = r.id AND a.kind = 'review' AND a.edits IS NOT NULL))::int AS edited,
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM approvals a WHERE a.run_id = r.id AND a.kind = 'review' AND a.status = 'rejected'))::int AS rejected
           FROM runs r WHERE r.workflow = $1 AND r.version = $2 AND r.mode = 'review'`, [wf.workflow, wf.version]);
      return { workflow: wf.workflow, version: wf.version, mode: wf.mode, runs: Object.fromEntries(runs.rows.map(r => [r.status, r.n])), review_mode: review.rows[0] };
    });

    api.post<{ Params: { name: string }; Body: { trigger_id?: string; payload?: Record<string, unknown> } }>('/api/workflows/:name/runs', async (req, reply) => {
      const wf = project.workflows.get(req.params.name);
      if (!wf) return reply.status(404).send({ error: 'unknown workflow' });
      const triggerId = req.body?.trigger_id ?? wf.triggers[0].id;
      if (!wf.triggers.some(t => t.id === triggerId)) return reply.status(400).send({ error: `no trigger "${triggerId}"` });
      const run = await startRun(db, wf, triggerId, req.body?.payload ?? {});
      return reply.status(201).send({ id: run.id, status: run.status });
    });

    api.get<{ Querystring: { workflow?: string; status?: string; limit?: string } }>('/api/runs', async req => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 500);
      const { rows } = await db.query(
        `SELECT id, workflow, version, mode, trigger_id, status, wake_at, error, stop_reason, created_at, finished_at FROM runs
          WHERE ($1::text IS NULL OR workflow = $1) AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC LIMIT $3`,
        [req.query.workflow ?? null, req.query.status ?? null, limit]);
      return rows;
    });

    api.get<{ Params: { id: string } }>('/api/runs/:id', async (req, reply) => {
      const { rows } = await db.query(`SELECT * FROM runs WHERE id::text = $1`, [req.params.id]);
      if (!rows.length) return reply.status(404).send({ error: 'not found' });
      const [steps, waits, approvals] = await Promise.all([
        db.query(`SELECT key, step_id, primitive, status, attempts, input, output, error, started_at, finished_at FROM run_steps WHERE run_id = $1 AND primitive <> 'decision' ORDER BY seq`, [rows[0].id]),
        db.query(`SELECT key, kind, channel, correlation, wake_at, resolved_at FROM run_waits WHERE run_id = $1 ORDER BY created_at`, [rows[0].id]),
        db.query(`SELECT id, step_key, kind, title, status, decided_by, note, created_at, decided_at FROM approvals WHERE run_id = $1 ORDER BY created_at`, [rows[0].id]),
      ]);
      const { definition, ...run } = rows[0];
      return { ...run, steps: steps.rows, waits: waits.rows, approvals: approvals.rows };
    });

    api.post<{ Params: { id: string } }>('/api/runs/:id/cancel', async (req, reply) => {
      const { rowCount } = await db.query(
        `UPDATE runs SET status = 'cancelled', finished_at = now(), updated_at = now(), locked_by = NULL WHERE id::text = $1 AND status IN ('queued', 'waiting')`, [req.params.id]);
      return rowCount ? { ok: true } : reply.status(409).send({ error: 'run is not queued or waiting' });
    });

    // Re-run a failed run from the step that failed (after fixing config or the outside system).
    api.post<{ Params: { id: string } }>('/api/runs/:id/retry', async (req, reply) => {
      const { rows } = await db.query(`SELECT id FROM runs WHERE id::text = $1 AND status = 'failed'`, [req.params.id]);
      if (!rows.length) return reply.status(409).send({ error: 'only failed runs can be retried' });
      await db.query(`DELETE FROM run_steps WHERE run_id = $1 AND status IN ('failed', 'started')`, [rows[0].id]);
      await db.query(`UPDATE runs SET status = 'queued', error = NULL, finished_at = NULL, updated_at = now() WHERE id = $1`, [rows[0].id]);
      return { ok: true };
    });

    api.get<{ Querystring: { status?: string } }>('/api/approvals', async req => {
      const { rows } = await db.query(
        `SELECT a.id, a.run_id, r.workflow, a.kind, a.title, a.detail, a.approver, a.status, a.expires_at, a.created_at
           FROM approvals a JOIN runs r ON r.id = a.run_id WHERE a.status = $1 ORDER BY a.created_at`, [req.query.status ?? 'pending']);
      return rows.map(a => ({ ...a, link: approvalLink(services, a.id) }));
    });

    api.post<{ Params: { id: string }; Body: { decision: 'approved' | 'rejected'; note?: string; edits?: Record<string, unknown>; by?: string } }>('/api/approvals/:id', async (req, reply) => {
      const { decision, note, edits, by } = req.body ?? ({} as never);
      if (decision !== 'approved' && decision !== 'rejected') return reply.status(400).send({ error: 'decision must be approved or rejected' });
      if (edits && (typeof edits !== 'object' || Array.isArray(edits))) return reply.status(400).send({ error: 'edits must be an object of parameter overrides' });
      try {
        const a = await decideApproval(db, req.params.id, { decision, note, edits, by: by ?? 'api' });
        return { ok: true, run_id: a.run_id };
      } catch (err) {
        if (err instanceof ApprovalConflict) return reply.status(409).send({ error: err.message });
        throw err;
      }
    });

    api.get<{ Querystring: { status?: string; assignee?: string } }>('/api/tasks', async req => (await db.query(
      `SELECT * FROM tasks WHERE status = $1 AND ($2::text IS NULL OR assignee = $2) ORDER BY coalesce(due_at, created_at)`,
      [req.query.status ?? 'open', req.query.assignee ?? null])).rows);

    api.post<{ Params: { id: string } }>('/api/tasks/:id/done', async (req, reply) => {
      const { rowCount } = await db.query(`UPDATE tasks SET status = 'done', completed_at = now() WHERE id::text = $1 AND status = 'open'`, [req.params.id]);
      return rowCount ? { ok: true } : reply.status(404).send({ error: 'no open task with that id' });
    });

    // Inject an inbound event by hand (testing, or systems without webhooks).
    api.post<{ Body: { channel: 'whatsapp' | 'email' | 'api' | 'form' | 'file' | 'db'; correlation?: string[]; payload: Record<string, unknown>; workflow?: string } }>('/api/events', async req =>
      deliverEvent(services, { channel: req.body.channel, correlation: req.body.correlation ?? [], payload: req.body.payload ?? {}, workflow: req.body.workflow }));
  });

  return app;
}
