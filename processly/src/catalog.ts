import { z } from 'zod';

/**
 * The primitive catalog: every building block a workflow may `use:`.
 * Each entry carries a parameter schema, checked after {{ }} templates are
 * resolved at run time. `control` lists parameters that are bare expressions
 * (evaluated by the engine, never template-resolved).
 */

export type Category = 'trigger' | 'ai' | 'data' | 'action' | 'control';

export interface Primitive {
  id: string;
  cat: Category;
  label: string;
  desc: string;
  params: z.ZodType;
  control?: string[];
  /** Contains child steps in `branches`. */
  container?: boolean;
  /**
   * For actions: true when these (resolved) params change nothing outside the
   * engine, so review mode doesn't gate them and crash-safety doesn't apply.
   */
  readOnly?: (params: Record<string, unknown>) => boolean;
}

const str = z.string();
const strList = z.union([z.array(z.string()), z.string().transform(s => [s])]);
const anyObj = z.record(z.string(), z.unknown());
const duration = z.union([z.string(), z.number()]);
const fileRef = z.object({ id: z.string() }).passthrough();
const fileRefs = z.union([z.array(fileRef), fileRef.transform(f => [f]), z.null().transform(() => [])]).default([]);
const recipient = z.union([z.string(), z.array(z.string())]);

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'trigger', label: 'Triggers' },
  { id: 'ai', label: 'AI actions' },
  { id: 'data', label: 'Data actions' },
  { id: 'action', label: 'Business actions' },
  { id: 'control', label: 'Control flow' },
];

const fieldSpec = z.union([
  z.array(z.string()),
  z.record(z.string(), z.union([
    z.string(),
    z.object({ type: z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']).default('string'), description: z.string().optional(), enum: z.array(z.string()).optional(), items: z.unknown().optional() }).strict(),
  ])),
]);

export const PRIMITIVES: Primitive[] = [
  // ---------------------------------------------------------------- triggers
  { id: 'trigger.form', cat: 'trigger', label: 'Web form', desc: 'A website or landing-page form is submitted.',
    params: z.object({}).passthrough() },
  { id: 'trigger.whatsapp', cat: 'trigger', label: 'WhatsApp message', desc: 'An inbound WhatsApp Business message: text, image or voice note.',
    params: z.object({ match: strList.optional(), types: strList.optional() }).passthrough() },
  { id: 'trigger.email', cat: 'trigger', label: 'Email received', desc: 'A message lands in a watched inbox.',
    params: z.object({ inbox: str.optional(), subject_contains: str.optional() }).passthrough() },
  { id: 'trigger.api', cat: 'trigger', label: 'API / webhook', desc: 'An event from a connected system: payment failed, quote sent, client onboarded.',
    params: z.object({ event: str.optional() }).passthrough() },
  { id: 'trigger.schedule', cat: 'trigger', label: 'Schedule', desc: 'Runs on a timetable: daily, weekly or a cron expression.',
    params: z.object({ cron: str.optional(), daily_at: z.string().regex(/^\d{1,2}:\d{2}$/).optional() }).passthrough()
      .refine(p => Boolean(p.cron) !== Boolean(p.daily_at), 'set exactly one of cron or daily_at') },
  { id: 'trigger.file', cat: 'trigger', label: 'File upload', desc: 'A document arrives through an upload link or as an email attachment.',
    params: z.object({ folder: str.optional() }).passthrough() },
  { id: 'trigger.db_event', cat: 'trigger', label: 'Database event', desc: 'A record is created or changes state in a table you own.',
    params: z.object({ table: str, on: z.enum(['insert', 'update', 'insert_or_update']).default('insert_or_update') }).passthrough() },

  // ---------------------------------------------------------------------- AI
  { id: 'ai.extract', cat: 'ai', label: 'Extract information', desc: 'Pull structured fields out of free text, photos, PDFs or voice notes.',
    params: z.object({ input: z.unknown().optional(), files: fileRefs, fields: fieldSpec, instructions: str.optional() }) },
  { id: 'ai.classify', cat: 'ai', label: 'Classify', desc: 'Sort an input into one of a fixed set of labels.',
    params: z.object({ input: z.unknown(), labels: z.union([z.array(z.string()).min(2), z.record(z.string(), z.string())]), detect_language: z.boolean().default(false), instructions: str.optional() }) },
  { id: 'ai.summarize', cat: 'ai', label: 'Summarize', desc: 'Condense data or documents into a short brief.',
    params: z.object({ input: z.unknown(), files: fileRefs, style: str.default('executive'), flags: z.array(z.string()).default([]), max_words: z.number().int().positive().default(150) }) },
  { id: 'ai.generate', cat: 'ai', label: 'Generate response', desc: 'Draft a message or document in your tone of voice.',
    params: z.object({ brief: str, context: z.unknown().optional(), format: z.enum(['text', 'email']).default('text'), tone: str.optional(), language: str.optional(), max_words: z.number().int().positive().default(120) }) },
  { id: 'ai.qualify', cat: 'ai', label: 'Qualify / score', desc: 'Score an input against a written rubric.',
    params: z.object({ input: z.unknown(), rubric: str }) },
  { id: 'ai.translate', cat: 'ai', label: 'Translate', desc: "Reply in the customer's own language.",
    params: z.object({ text: str, to: str }) },
  { id: 'ai.sentiment', cat: 'ai', label: 'Detect sentiment', desc: 'Detect tone, urgency and frustration.',
    params: z.object({ input: z.unknown(), rating_scale: z.number().int().min(2).max(10).optional() }) },
  { id: 'ai.decide', cat: 'ai', label: 'Structured decision', desc: 'Choose from a fixed catalog by weighted criteria, with reasons.',
    params: z.object({ input: z.unknown(), options: z.array(z.unknown()).min(1), criteria: z.array(z.string()).min(1), choose: z.number().int().min(1).default(1) }) },

  // -------------------------------------------------------------------- data
  { id: 'data.validate', cat: 'data', label: 'Validate', desc: 'Check inputs against business rules before anything acts on them.',
    params: z.object({ rules: z.array(z.object({ name: str, check: str, message: str.optional() })).min(1), on_fail: z.enum(['stop', 'continue']).default('continue') }),
    control: ['rules'] },
  { id: 'data.transform', cat: 'data', label: 'Transform', desc: 'Normalize, reshape or compute fields.',
    params: z.object({ set: anyObj }) },
  { id: 'data.dedupe', cat: 'data', label: 'Deduplicate', desc: 'Merge repeat contacts and events arriving from different channels.',
    params: z.object({ namespace: str, keys: z.array(z.union([z.string(), z.number(), z.null()])).min(1) }) },
  { id: 'data.enrich', cat: 'data', label: 'Enrich', desc: 'Add context from other systems: history, tracking, price lists.',
    params: z.object({
      sql: str.optional(), params: z.array(z.unknown()).default([]),
      connection: str.optional(), method: z.enum(['GET', 'POST']).default('GET'), path: str.optional(), query: anyObj.optional(), body: z.unknown().optional(),
      records: z.object({ collection: str, key: str }).optional(),
    }).refine(p => [p.sql, p.connection, p.records].filter(Boolean).length === 1, 'set exactly one of sql, connection or records') },
  { id: 'data.store', cat: 'data', label: 'Store', desc: 'Save files and records where they belong, named consistently.',
    params: z.object({ collection: str.optional(), key: str.optional(), data: z.unknown().optional(), file: fileRef.optional(), folder: str.optional(), name: str.optional() })
      .refine(p => Boolean(p.file) !== Boolean(p.collection), 'set either file (+ folder) or collection (+ key, data)') },
  { id: 'data.query', cat: 'data', label: 'Query', desc: 'Look up records: orders, invoices, waitlists, catalogs.',
    params: z.object({ sql: str.optional(), params: z.array(z.unknown()).default([]), records: z.object({ collection: str }).optional(), limit: z.number().int().positive().default(500) })
      .refine(p => Boolean(p.sql) !== Boolean(p.records), 'set exactly one of sql or records') },

  // ----------------------------------------------------------------- actions
  { id: 'send.email', cat: 'action', label: 'Send email', desc: 'Send an email from your own domain, with attachments.',
    params: z.object({ to: recipient, cc: recipient.optional(), subject: str, text: str, html: str.optional(), attach: fileRefs, reply_to: str.optional(), in_reply_to: str.optional() }) },
  { id: 'send.whatsapp', cat: 'action', label: 'Send WhatsApp', desc: 'Send a WhatsApp Business message, template or reply buttons.',
    params: z.object({
      to: str, text: str.optional(), buttons: z.array(z.string()).max(3).optional(),
      template: z.object({ name: str, language: str.default('en'), params: z.array(z.union([z.string(), z.number()])).default([]) }).optional(),
      document: fileRef.optional(), reply_to: str.optional(),
    }).refine(p => Boolean(p.text) || Boolean(p.template) || Boolean(p.document), 'set text, template or document') },
  { id: 'crm.create', cat: 'action', label: 'Create CRM record', desc: 'Create a lead, deal, candidate or contact.',
    params: z.object({ object: str, stage: str.optional(), data: anyObj.default({}) }) },
  { id: 'crm.update', cat: 'action', label: 'Update CRM', desc: 'Move a stage, set a field or log activity.',
    params: z.object({ object: str, record_id: z.union([z.string(), z.number()]).transform(String), stage: str.optional(), data: anyObj.default({}) }) },
  { id: 'task.create', cat: 'action', label: 'Create task', desc: 'Hand a job to a person, with context attached.',
    params: z.object({ title: str, body: str.optional(), assignee: str.optional(), due_in: duration.optional(), notify: z.boolean().default(true) }) },
  { id: 'calendar.book', cat: 'action', label: 'Schedule appointment', desc: 'Book, hold or release calendar slots.',
    params: z.object({
      action: z.enum(['find_slots', 'book', 'hold', 'release']).default('book'),
      calendar: str, title: str.optional(), start: str.optional(), duration: duration.default('30m'),
      attendees: z.array(z.string()).default([]), description: str.optional(), event_id: str.optional(),
      within: duration.default('7d'), count: z.number().int().min(1).max(10).default(3),
      hours: z.tuple([z.number(), z.number()]).default([9, 17]), days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
    }), readOnly: p => p.action === 'find_slots' },
  { id: 'doc.generate', cat: 'action', label: 'Generate document', desc: 'Produce quotes, invoices, reports and packs from templates.',
    params: z.object({ template: str, data: anyObj.default({}), title: str.optional(), filename: str.optional() }), readOnly: () => true },
  { id: 'notify.team', cat: 'action', label: 'Notify team', desc: 'Alert staff on Slack, WhatsApp or email.',
    params: z.object({ to: recipient.default('team'), text: str, channel: z.enum(['auto', 'slack', 'email', 'whatsapp']).default('auto') }) },
  { id: 'integration.call', cat: 'action', label: 'Call connected system', desc: 'Act inside another tool: payments, ERP, PMS, accounting.',
    params: z.object({ connection: str, method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'), path: str, query: anyObj.optional(), body: z.unknown().optional(), idempotent: z.boolean().default(false) }),
    readOnly: p => p.method === 'GET' },

  // ----------------------------------------------------------------- control
  { id: 'control.branch', cat: 'control', label: 'If / else', desc: 'Take one of two or more paths based on a condition.',
    params: z.object({}).passthrough(), container: true },
  { id: 'control.switch', cat: 'control', label: 'Switch', desc: 'Route by value into several labelled paths.',
    params: z.object({ on: str }).passthrough(), control: ['on'], container: true },
  { id: 'control.loop', cat: 'control', label: 'Loop', desc: 'Repeat steps for each item, or on a cadence until a condition is met.',
    params: z.object({ over: str.optional(), every: duration.optional(), while: str.optional(), stop_when: str.optional(), max: z.number().int().min(1).max(1000).default(50) })
      .refine(p => Boolean(p.over) !== Boolean(p.every), 'set exactly one of over (for each) or every (cadence)'),
    control: ['over', 'while', 'stop_when'], container: true },
  { id: 'control.wait', cat: 'control', label: 'Wait', desc: 'Pause for a duration or until an event happens.',
    params: z.object({
      for: duration.optional(), until: z.union([z.string(), z.number()]).optional(),
      event: z.object({ channel: z.enum(['whatsapp', 'email', 'api', 'file', 'form']), key: z.union([z.string(), z.array(z.string())]) }).optional(),
      timeout: duration.optional(),
    }).refine(p => (p.event ? p.for == null && !(p.until != null && p.timeout != null) : [p.for, p.until].filter(v => v != null).length === 1 && p.timeout == null),
      'set for, until, or event (optionally with timeout or until as its deadline)') },
  { id: 'control.retry', cat: 'control', label: 'Retry', desc: 'Retry a flaky step on a back-off ladder.',
    params: z.object({ backoff: z.array(duration).min(1).default(['1m', '10m', '1h']), on_exhausted: z.enum(['fail', 'continue']).default('continue') }),
    container: true },
  { id: 'control.approval', cat: 'control', label: 'Human approval', desc: 'A person approves before the workflow continues.',
    params: z.object({ title: str, detail: z.unknown().optional(), approver: str.default('manager'), timeout: duration.optional(), on_timeout: z.enum(['approve', 'reject']).default('reject'), on_reject: z.enum(['stop', 'continue']).default('stop') }) },
];

export const PRIMITIVE_BY_ID = new Map(PRIMITIVES.map(p => [p.id, p]));

/** Parameters every step accepts, handled by the engine rather than the primitive. */
export const RESERVED_STEP_KEYS = new Set(['id', 'label', 'use', 'note', 'if', 'on_error', 'branches']);
export const RESERVED_TRIGGER_KEYS = new Set(['id', 'label', 'use', 'note', 'when']);
