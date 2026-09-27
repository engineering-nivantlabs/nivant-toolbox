import { loadConfig, type Config } from './config.js';
import { createConnectors } from './connectors/index.js';
import { createPool, migrate } from './db.js';
import type { Services } from './engine/types.js';
import { Worker } from './engine/worker.js';
import { configureTime } from './expr.js';
import { configureLinks } from './links.js';
import { loadProject } from './project.js';
import { buildServer } from './server.js';
import { startDbListener, startImapPoller, startScheduler } from './triggers.js';
import { eachStep } from './workflow.js';

/** Warns about integrations the enabled workflows use but that aren't configured. */
export function configWarnings(services: Services): string[] {
  const { config: c, project } = services;
  const uses = new Set<string>();
  const connections = new Set<string>();
  for (const wf of project.workflows.values()) {
    wf.triggers.forEach(t => uses.add(t.use));
    eachStep(wf.steps, s => {
      uses.add(s.use);
      if (typeof s.connection === 'string') connections.add(s.connection);
    });
  }
  const has = (prefix: string) => [...uses].some(u => u.startsWith(prefix));
  const warnings: string[] = [];
  if (has('ai.') && !c.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) warnings.push('AI steps are used but ANTHROPIC_API_KEY is not set');
  if (has('send.email') && !(c.SMTP_URL && c.EMAIL_FROM)) warnings.push('send.email is used but SMTP_URL / EMAIL_FROM are not set');
  if ((has('send.whatsapp') || uses.has('trigger.whatsapp')) && !(c.WHATSAPP_TOKEN && c.WHATSAPP_PHONE_NUMBER_ID)) warnings.push('WhatsApp is used but WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are not set');
  if (uses.has('trigger.whatsapp') && !(c.WHATSAPP_APP_SECRET && c.WHATSAPP_VERIFY_TOKEN)) warnings.push('trigger.whatsapp needs WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN to accept webhooks');
  if (uses.has('trigger.email') && !(c.IMAP_HOST && c.IMAP_USER && c.IMAP_PASSWORD)) warnings.push('trigger.email is used but IMAP_HOST / IMAP_USER / IMAP_PASSWORD are not set');
  for (const name of connections) {
    const conn = project.connections[name];
    if (!conn) warnings.push(`connection "${name}" is used but not declared in connections.yaml`);
    else if (conn.missing?.length) warnings.push(`connection "${name}" needs ${[...new Set(conn.missing)].join(', ')}`);
  }
  return warnings;
}

export async function createServices(config: Config = loadConfig(), opts: { now?: () => Date } = {}): Promise<Services> {
  const project = loadProject(config.configDir);
  const db = createPool(config.DATABASE_URL);
  await migrate(db);
  configureLinks(config.HOOK_SECRET, config.PUBLIC_URL);
  configureTime(project.business.timezone ?? config.TZ);
  return { db, config, project, connectors: createConnectors(config, db, project), now: opts.now ?? (() => new Date()) };
}

export interface Roles { http: boolean; worker: boolean; triggers: boolean }

/** Starts the HTTP server, worker and background triggers (any subset). */
export async function start(roles: Roles = { http: true, worker: true, triggers: true }) {
  const services = await createServices();
  const stops: (() => unknown)[] = [];
  const { config, project } = services;
  console.log(`[processly] ${project.business.name}: ${project.workflows.size} workflow(s) — ${[...project.workflows.keys()].join(', ')}`);
  for (const w of configWarnings(services)) console.warn(`[processly] warning: ${w}`);

  if (roles.worker) {
    const worker = new Worker(services);
    worker.start();
    stops.push(() => worker.stop());
    console.log(`[processly] worker ${worker.id} (concurrency ${config.WORKER_CONCURRENCY})`);
  }
  if (roles.triggers) {
    stops.push(startScheduler(services), startImapPoller(services), startDbListener(services));
  }
  if (roles.http) {
    const app = buildServer(services);
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    stops.push(() => app.close());
    console.log(`[processly] listening on :${config.PORT} (${config.PUBLIC_URL})`);
  }

  const shutdown = async (signal: string) => {
    console.log(`[processly] ${signal}: shutting down`);
    for (const s of stops.reverse()) await s();
    await services.db.end();
    process.exit(0);
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return services;
}
