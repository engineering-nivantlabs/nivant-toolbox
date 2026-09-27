import { findSlots } from '../connectors/calendar.js';
import { markdownToPdf, renderTemplate } from '../connectors/pdf.js';
import { parseDuration, toMillis } from '../expr.js';
import { readProjectFile } from '../project.js';
import { StepError, type Handler, type StepContext } from '../engine/types.js';

const list = (v: string | string[] | undefined) => (v == null ? [] : ([] as string[]).concat(v).flatMap(s => s.split(',')).map(s => s.trim()).filter(Boolean));
const tz = (sc: StepContext) => sc.services.project.business.timezone ?? sc.services.config.TZ;

export const sendEmail: Handler = async (p, sc) => {
  const c = sc.services.connectors;
  const attachments = await Promise.all((p.attach as { id: string }[]).map(async f => {
    const { ref, data } = await c.files.get(f.id);
    return { filename: ref.name, content: data, contentType: ref.mime };
  }));
  const to = list(p.to);
  if (!to.length) throw new StepError('send.email: no recipients');
  const r = await c.email.send({ to, cc: list(p.cc), subject: p.subject, text: p.text, html: p.html, replyTo: p.reply_to, inReplyTo: p.in_reply_to, attachments, idempotencyKey: sc.idempotencyKey });
  return { ...r, to };
};

export const sendWhatsApp: Handler = async (p, sc) => {
  const c = sc.services.connectors;
  if (p.document) {
    const { ref, data } = await c.files.get(p.document.id);
    return c.whatsapp.sendDocument(p.to, { name: ref.name, mime: ref.mime, data }, p.text);
  }
  if (p.template) return c.whatsapp.sendTemplate(p.to, p.template.name, p.template.language, p.template.params);
  if (p.buttons?.length) return c.whatsapp.sendButtons(p.to, p.text, p.buttons, p.reply_to);
  return c.whatsapp.sendText(p.to, p.text, p.reply_to);
};

export const crmCreate: Handler = async (p, sc) => sc.services.connectors.crm.create(p.object, p.stage, p.data, sc.run.id);
export const crmUpdate: Handler = async (p, sc) => sc.services.connectors.crm.update(p.object, p.record_id, p.stage, p.data);

export const taskCreate: Handler = async (p, sc) => {
  const due = p.due_in != null ? new Date(sc.services.now().getTime() + parseDuration(p.due_in)) : null;
  const { rows } = await sc.services.db.query(
    `INSERT INTO tasks (run_id, title, body, assignee, due_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [sc.run.id, p.title, p.body ?? null, p.assignee ?? null, due]);
  let notified = false;
  if (p.notify && p.assignee) {
    try {
      await sc.services.connectors.notify.send(p.assignee, `New task: ${p.title}${p.body ? `\n${p.body}` : ''}${due ? `\nDue ${due.toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}`, 'auto', sc.idempotencyKey);
      notified = true;
    } catch (err) {
      // The task exists either way; retrying would create a duplicate.
      sc.log(`task created but notifying ${p.assignee} failed: ${(err as Error).message}`);
    }
  }
  return { task_id: rows[0].id, due_at: due, notified };
};

export const calendarBook: Handler = async (p, sc) => {
  const cal = sc.services.connectors.calendar;
  const durationMs = parseDuration(p.duration);
  const zone = tz(sc);
  const label = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  if (p.action === 'find_slots') {
    const slots = await findSlots(cal, { calendar: p.calendar, durationMs, withinMs: parseDuration(p.within), count: p.count, hours: p.hours, days: p.days, timezone: zone, now: sc.services.now() });
    return { slots: slots.map(s => ({ ...s, label: label(s.start) })), labels: slots.map(s => label(s.start)), count: slots.length };
  }
  if (p.action === 'release') {
    if (!p.event_id) throw new StepError('calendar.book release needs event_id');
    return cal.release(p.calendar, p.event_id);
  }
  if (!p.start) throw new StepError(`calendar.book ${p.action} needs start`);
  const start = new Date(toMillis(p.start));
  const booking = await cal.book({ calendar: p.calendar, title: p.title ?? 'Appointment', start, end: new Date(start.getTime() + durationMs), attendees: p.attendees, description: p.description, hold: p.action === 'hold', runId: sc.run.id });
  return { ...booking, label: label(booking.start) };
};

export const docGenerate: Handler = async (p, sc) => {
  const { project, connectors } = sc.services;
  const template = readProjectFile(project, 'documents', p.template);
  const markdown = await renderTemplate(template, { data: p.data, business: project.business, now: sc.services.now().toISOString(), run: { id: sc.run.id } });
  const title = p.title ?? markdown.match(/^#\s+(.+)$/m)?.[1] ?? p.template.replace(/\.md$/, '');
  const pdf = await markdownToPdf(markdown, title);
  const name = p.filename ?? `${title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'document'}.pdf`;
  const file = await connectors.files.save(pdf, name, 'application/pdf', { folder: 'generated', runId: sc.run.id, meta: { template: p.template } });
  return { file, title, pages_bytes: pdf.length };
};

export const notifyTeam: Handler = async (p, sc) => sc.services.connectors.notify.send(p.to, p.text, p.channel, sc.idempotencyKey);

export const integrationCall: Handler = async (p, sc) => {
  const r = await sc.services.connectors.http.call(p.connection, { method: p.method, path: p.path, query: p.query, body: p.body, idempotencyKey: sc.idempotencyKey });
  return { status: r.status, data: r.body };
};
