import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { createServices } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { Services } from '../src/engine/types.js';
import { Worker } from '../src/engine/worker.js';
import { parseDuration } from '../src/expr.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATES = path.join(ROOT, 'templates');
const ADMIN_URL = process.env.TEST_PG_URL ?? 'postgresql://postgres@localhost:54329/postgres';

// ------------------------------------------------------------ fake services

type Json = Record<string, any>;
export interface Recorded { method: string; path: string; headers: http.IncomingHttpHeaders; body: any; raw: Buffer }
type AiResponder = (req: { system: string; task: string; input: string; schema: Json }) => unknown | undefined;
type Route = (req: Recorded) => { status?: number; body?: unknown; raw?: Buffer; type?: string } | undefined;

/** Builds a value that satisfies a JSON schema: first enum value, 0.8 for numbers, "stub" for strings. */
export function fromSchema(s: Json): unknown {
  const types: string[] = [].concat(s.type ?? 'string');
  if (s.enum) return s.enum.find((v: unknown) => v !== null) ?? null;
  const t = types.find(x => x !== 'null') ?? 'null';
  if (t === 'object') return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, fromSchema(v as Json)]));
  if (t === 'array') return [fromSchema(s.items ?? { type: 'string' })];
  if (t === 'number') return 0.8;
  if (t === 'integer') return 1;
  if (t === 'boolean') return true;
  if (t === 'null') return null;
  return 'stub';
}

/**
 * One local HTTP server standing in for the Anthropic Messages API, the
 * WhatsApp Graph API, Slack and every connection in connections.yaml.
 */
export class Fakes {
  requests: Recorded[] = [];
  ai: AiResponder[] = [];
  routes: Route[] = [];
  aiCalls: { task: string; input: string; schema: Json; model: string; effort?: string; fallbacks?: unknown; betas?: string }[] = [];
  private server!: http.Server;
  url = '';

  async start() {
    this.server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        let body: any = raw.toString('utf8');
        try { body = JSON.parse(body); } catch { /* form or multipart */ }
        const rec: Recorded = { method: req.method!, path: req.url!, headers: req.headers, body, raw };
        this.requests.push(rec);
        let out: ReturnType<Fakes['handle']>;
        try { out = this.handle(rec); } catch (err) {
          console.error('[fakes] handler threw:', err);
          out = { status: 500, body: { error: { type: 'api_error', message: String(err) } } };
        }
        res.writeHead(out.status ?? 200, { 'Content-Type': out.type ?? 'application/json' });
        res.end(out.raw ?? JSON.stringify(out.body ?? {}));
      });
    });
    await new Promise<void>(r => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }

  stop() { return new Promise(r => this.server.close(r)); }

  reset() { this.requests = []; this.aiCalls = []; this.ai = []; this.routes = []; }

  sent(prefix: string) { return this.requests.filter(r => r.path.startsWith(prefix) && r.method !== 'GET'); }
  whatsappSent() { return this.sent('/wa/').filter(r => r.path.endsWith('/messages')).map(r => r.body); }

  private handle(r: Recorded): { status?: number; body?: unknown; raw?: Buffer; type?: string } {
    for (const route of this.routes) { const out = route(r); if (out) return out; }
    if (r.path.startsWith('/v1/messages')) return { body: this.claude(r) };
    if (r.path.startsWith('/wa/')) {
      if (r.path.endsWith('/messages')) return { body: { messages: [{ id: `wamid.${this.requests.length}` }] } };
      if (r.path.endsWith('/media') && r.method === 'POST') return { body: { id: 'media-upload-1' } };
      const m = /^\/wa\/(media-[\w-]+)$/.exec(r.path);
      if (m) return { body: { url: `${this.url}/bytes/${m[1]}`, mime_type: 'image/jpeg' } };
    }
    if (r.path.startsWith('/bytes/')) return { raw: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), type: 'image/jpeg' };
    return { body: { ok: true } };
  }

  private claude(r: Recorded) {
    const b = r.body;
    const system: string = typeof b.system === 'string' ? b.system : '';
    const task = system.split('Your task: ')[1]?.split('\n\nBase every answer')[0] ?? '';
    const input = (b.messages?.[0]?.content ?? []).filter((c: Json) => c.type === 'text').map((c: Json) => c.text).join('\n');
    const schema = b.output_config?.format?.schema ?? {};
    this.aiCalls.push({ task, input, schema, model: b.model, effort: b.output_config?.effort, fallbacks: b.fallbacks, betas: String(r.headers['anthropic-beta'] ?? '') });
    let out: unknown;
    for (const f of this.ai) { out = f({ system, task, input, schema }); if (out !== undefined) break; }
    if (out === undefined) out = fromSchema(schema);
    return {
      id: `msg_${this.aiCalls.length}`, type: 'message', role: 'assistant', model: b.model,
      content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    };
  }
}

export class Mailbox {
  messages: { from: string; to: string[]; raw: string }[] = [];
  private server!: SMTPServer;
  port = 0;

  async start() {
    this.server = new SMTPServer({
      authOptional: true, disabledCommands: ['STARTTLS'], logger: false,
      onData: (stream, session, cb) => {
        let raw = '';
        stream.on('data', d => { raw += d; });
        stream.on('end', () => { this.messages.push({ from: String(session.envelope.mailFrom && session.envelope.mailFrom.address), to: session.envelope.rcptTo.map(r => r.address), raw }); cb(); });
      },
    });
    await new Promise<void>(r => this.server.listen(0, '127.0.0.1', r));
    this.port = (this.server.server.address() as AddressInfo).port;
    return this;
  }

  stop() { return new Promise(r => this.server.close(r)); }
  reset() { this.messages = []; }
  subjects() { return this.messages.map(m => /^Subject: (.*)$/m.exec(m.raw)?.[1] ?? ''); }
}

// ------------------------------------------------------------- environment

export interface Env {
  services: Services;
  fakes: Fakes;
  mail: Mailbox;
  worker: Worker;
  clock: { now: Date };
  dbName: string;
  /** Moves the fake clock forward and makes runs due by then claimable. */
  advance(d: string): Promise<void>;
  /** Executes everything runnable right now. */
  drain(): Promise<void>;
  run(id: string): Promise<Json>;
  steps(id: string): Promise<Json[]>;
  close(): Promise<void>;
}

/** A project directory with only some of the template workflows enabled (as a client deployment would). */
export function projectWith(workflows: string[]): string {
  const dir = fs.mkdtempSync(path.join(ROOT, 'data', 'project-'));
  for (const f of ['business.yaml', 'team.yaml', 'connections.yaml']) fs.copyFileSync(path.join(TEMPLATES, f), path.join(dir, f));
  for (const d of ['rubrics', 'documents']) fs.cpSync(path.join(TEMPLATES, d), path.join(dir, d), { recursive: true });
  fs.mkdirSync(path.join(dir, 'workflows'));
  for (const w of workflows) fs.copyFileSync(path.join(TEMPLATES, 'workflows', `${w}.yaml`), path.join(dir, 'workflows', `${w}.yaml`));
  return dir;
}

export async function setup(opts: { workflows?: string[]; configDir?: string; env?: Record<string, string>; now?: string } = {}): Promise<Env> {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  const projectDir = opts.workflows ? projectWith(opts.workflows) : null;
  const fakes = await new Fakes().start();
  const mail = await new Mailbox().start();
  const dbName = `processly_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();
  const dbUrl = ADMIN_URL.replace(/\/[^/]*$/, `/${dbName}`);

  const env: Record<string, string> = {
    DATABASE_URL: dbUrl,
    CONFIG_DIR: projectDir ?? opts.configDir ?? TEMPLATES,
    FILES_DIR: path.join(ROOT, 'data', 'test-files', dbName),
    ADMIN_TOKEN: 'test-admin-token-123456', HOOK_SECRET: 'test-hook-secret-123456',
    PUBLIC_URL: 'https://engine.example.com', TZ: 'UTC',
    ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: fakes.url,
    SMTP_URL: `smtp://127.0.0.1:${mail.port}?ignoreTLS=true`, EMAIL_FROM: 'Demo Business <hello@demo.example>',
    WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_NUMBER_ID: '1555000', WHATSAPP_APP_SECRET: 'wa-app-secret', WHATSAPP_VERIFY_TOKEN: 'verify-me',
    WHATSAPP_API_BASE: `${fakes.url}/wa`,
    SLACK_WEBHOOK_URL: `${fakes.url}/slack`,
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STEP_MAX_ATTEMPTS: '2',
    ACCOUNTING_API_URL: `${fakes.url}/conn/accounting`, CLINIC_API_URL: `${fakes.url}/conn/clinic`, CARRIER_API_URL: `${fakes.url}/conn/carrier`,
    QUOTE_ENGINE_URL: `${fakes.url}/conn/quote_engine`, PMS_API_URL: `${fakes.url}/conn/pms`, ERP_API_URL: `${fakes.url}/conn/erp`,
    STRIPE_SECRET_KEY: 'sk_stripe_test', ACCOUNTING_API_TOKEN: 't', CLINIC_API_TOKEN: 't', CARRIER_API_TOKEN: 't', QUOTE_ENGINE_TOKEN: 't', PMS_API_TOKEN: 't', ERP_API_TOKEN: 't',
    ...opts.env,
  };
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  const clock = { now: new Date(opts.now ?? Date.now()) };
  const services = await createServices(loadConfig(env), { now: () => clock.now });
  // The stripe connection points at api.stripe.com; route it to the fakes too.
  (services.project.connections.stripe as { base_url: string }).base_url = `${fakes.url}/conn/stripe`;
  await services.db.query(fs.readFileSync(path.join(TEMPLATES, 'sample-data.sql'), 'utf8'));
  const worker = new Worker(services);

  const e: Env = {
    services, fakes, mail, worker, clock, dbName,
    async advance(d) {
      clock.now = new Date(clock.now.getTime() + parseDuration(d));
      await services.db.query(`UPDATE runs SET wake_at = now() - interval '1 second' WHERE status = 'waiting' AND wake_at <= $1`, [clock.now]);
    },
    drain: () => worker.drain(),
    async run(id) { return (await services.db.query(`SELECT * FROM runs WHERE id = $1`, [id])).rows[0]; },
    async steps(id) { return (await services.db.query(`SELECT key, step_id, primitive, status, output, error FROM run_steps WHERE run_id = $1 AND primitive <> 'decision' ORDER BY seq`, [id])).rows; },
    async close() {
      await services.db.end();
      if (services.connectors.dataDb !== services.db) await services.connectors.dataDb.end();
      await fakes.stop();
      await mail.stop();
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await a.end();
      fs.rmSync(env.FILES_DIR, { recursive: true, force: true });
      if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
    },
  };
  return e;
}

/** Builds a signed WhatsApp Cloud API webhook body for one inbound message. */
export function whatsappWebhook(m: { from: string; name?: string; text?: string; id?: string; button?: string; contextId?: string; imageId?: string }) {
  const message: Json = { from: m.from, id: m.id ?? `wamid.in.${Math.random().toString(36).slice(2)}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  if (m.button) Object.assign(message, { type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'b0', title: m.button } } });
  else if (m.imageId) Object.assign(message, { type: 'image', image: { id: m.imageId, mime_type: 'image/jpeg', caption: m.text } });
  else Object.assign(message, { type: 'text', text: { body: m.text ?? '' } });
  if (m.contextId) message.context = { id: m.contextId };
  return { object: 'whatsapp_business_account', entry: [{ id: 'waba', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', contacts: [{ wa_id: m.from, profile: { name: m.name ?? 'Customer' } }], messages: [message] } }] }] };
}

// ------------------------------------------------------------- shortcuts

import { decideApproval } from '../src/engine/approvals.js';
import { deliverEvent, startRun, type InboundEvent } from '../src/engine/events.js';

export async function start(e: Env, workflow: string, triggerId: string, payload: Record<string, unknown>) {
  const wf = e.services.project.workflows.get(workflow);
  if (!wf) throw new Error(`workflow ${workflow} not loaded`);
  return (await startRun(e.services.db, wf, triggerId, payload)).id;
}

export const deliver = (e: Env, ev: InboundEvent) => deliverEvent(e.services, ev);

export async function pendingApprovals(e: Env, runId?: string) {
  return (await e.services.db.query(`SELECT * FROM approvals WHERE status = 'pending' AND ($1::uuid IS NULL OR run_id = $1) ORDER BY created_at`, [runId ?? null])).rows;
}

/** Approves everything pending (optionally only for one run), then drains. Repeats until nothing is pending. */
export async function approveAll(e: Env, runId?: string, max = 20) {
  const decided: any[] = [];
  for (let i = 0; i < max; i++) {
    const pending = await pendingApprovals(e, runId);
    if (!pending.length) return decided;
    for (const a of pending) { await decideApproval(e.services.db, a.id, { decision: 'approved', by: 'test' }); decided.push(a); }
    await e.drain();
  }
  throw new Error('approvals kept coming');
}

/** A captured SMTP message, decoded (MIME words, attachments) for assertions. */
export async function mailParts(raw: string) {
  const m = await simpleParser(raw);
  const addr = (a: typeof m.to) => (Array.isArray(a) ? a : a ? [a] : []).flatMap(x => x.value.map(v => v.address)).join(', ') || null;
  return { subject: m.subject ?? null, to: addr(m.to), cc: addr(m.cc), inReplyTo: m.inReplyTo ?? null, text: m.text ?? '', hasPdf: m.attachments.some(a => a.contentType === 'application/pdf'), attachments: m.attachments, raw };
}
