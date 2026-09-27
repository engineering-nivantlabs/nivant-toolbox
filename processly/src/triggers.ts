import { Cron } from 'croner';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pg from 'pg';
import { deliverEvent, startRun } from './engine/events.js';
import type { Services } from './engine/types.js';

const emailAddr = (a: string) => a.trim().toLowerCase();

/** Cron triggers. Every worker may run this; schedule_fires makes each firing happen once. */
export function startScheduler(services: Services): () => void {
  const jobs: Cron[] = [];
  const timezone = services.project.business.timezone ?? services.config.TZ;
  for (const wf of services.project.workflows.values()) {
    for (const t of wf.triggers) {
      if (t.use !== 'trigger.schedule') continue;
      const pattern = t.cron ? String(t.cron) : (() => { const [h, m] = String(t.daily_at).split(':'); return `${Number(m)} ${Number(h)} * * *`; })();
      const job = new Cron(pattern, { timezone, protect: true }, async self => {
        const fireAt = new Date(Math.floor((self.currentRun()?.getTime() ?? Date.now()) / 1000) * 1000);
        try {
          const claimed = await services.db.query(
            `INSERT INTO schedule_fires (workflow, trigger_id, fire_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING fire_at`, [wf.workflow, t.id, fireAt]);
          if (!claimed.rows.length) return;
          const run = await startRun(services.db, wf, t.id, { scheduled_at: fireAt.toISOString() });
          await services.db.query(`UPDATE schedule_fires SET run_id = $4 WHERE workflow = $1 AND trigger_id = $2 AND fire_at = $3`, [wf.workflow, t.id, fireAt, run.id]);
          console.log(`[schedule] ${wf.workflow}/${t.id} fired → run ${run.id}`);
        } catch (err) {
          console.error(`[schedule] ${wf.workflow}/${t.id} failed to fire`, err);
        }
      });
      jobs.push(job);
      console.log(`[schedule] ${wf.workflow}/${t.id}: "${pattern}" (${timezone}), next ${job.nextRun()?.toISOString()}`);
    }
  }
  return () => jobs.forEach(j => j.stop());
}

/** Polls an IMAP inbox; each unseen message becomes an `email` event. */
export function startImapPoller(services: Services): () => void {
  const c = services.config;
  if (!c.IMAP_HOST || !c.IMAP_USER || !c.IMAP_PASSWORD) return () => {};
  let stopped = false;
  let timer: NodeJS.Timeout;

  const poll = async () => {
    const client = new ImapFlow({ host: c.IMAP_HOST!, port: c.IMAP_PORT, secure: c.IMAP_SECURE, auth: { user: c.IMAP_USER!, pass: c.IMAP_PASSWORD! }, logger: false });
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        for (const uid of uids) {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const mail = await simpleParser(msg.source);
          const files = [];
          for (const a of mail.attachments) {
            files.push(await services.connectors.files.save(a.content, a.filename ?? 'attachment', a.contentType, { folder: 'email' }));
          }
          const from = mail.from?.value[0];
          const refs = ([] as string[]).concat(mail.references ?? []);
          const to = (Array.isArray(mail.to) ? mail.to : mail.to ? [mail.to] : []).flatMap(t => t.value.map(v => emailAddr(v.address ?? '')));
          await deliverEvent(services, {
            channel: 'email',
            correlation: [from?.address ? emailAddr(from.address) : '', mail.inReplyTo ?? '', ...refs].filter(Boolean),
            idemKey: mail.messageId ?? `imap:${uid}`,
            payload: {
              from: from?.address ? emailAddr(from.address) : null, from_name: from?.name || null, to,
              subject: mail.subject ?? '', text: mail.text ?? '', message_id: mail.messageId ?? null, in_reply_to: mail.inReplyTo ?? null,
              date: mail.date?.toISOString() ?? null, files, attachments: files.map(f => f.name),
            },
          });
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.error('[imap] poll failed:', (err as Error).message);
    } finally {
      await client.logout().catch(() => {});
      if (!stopped) timer = setTimeout(poll, c.IMAP_POLL_MS);
    }
  };
  poll();
  console.log(`[imap] polling ${c.IMAP_USER}@${c.IMAP_HOST} every ${c.IMAP_POLL_MS / 1000}s`);
  return () => { stopped = true; clearTimeout(timer); };
}

/** LISTENs for processly_notify() rows from the business database (trigger.db_event). */
export function startDbListener(services: Services): () => void {
  const wanted = [...services.project.workflows.values()].some(wf => wf.triggers.some(t => t.use === 'trigger.db_event'));
  if (!wanted) return () => {};
  let client: pg.Client | null = null;
  let stopped = false;
  const connect = async () => {
    client = new pg.Client({ connectionString: services.config.DATA_DATABASE_URL ?? services.config.DATABASE_URL });
    client.on('notification', async n => {
      try {
        const e = JSON.parse(n.payload ?? '{}');
        const id = e.row?.id != null ? `${e.table}:${e.row.id}` : null;
        await deliverEvent(services, { channel: 'db', correlation: id ? [id] : [], payload: e });
      } catch (err) {
        console.error('[db-listen] bad notification', err);
      }
    });
    client.on('error', err => {
      console.error('[db-listen] connection lost:', err.message);
      client?.end().catch(() => {});
      if (!stopped) setTimeout(connect, 5000);
    });
    try {
      await client.connect();
      await client.query('LISTEN processly_events');
      console.log('[db-listen] listening on processly_events');
    } catch (err) {
      console.error('[db-listen] connect failed:', (err as Error).message);
      if (!stopped) setTimeout(connect, 5000);
    }
  };
  connect();
  return () => { stopped = true; client?.end().catch(() => {}); };
}
