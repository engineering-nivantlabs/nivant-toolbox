/*
 * Processly primitive catalog.
 *
 * Every workflow template is configuration over these building blocks — a
 * template may only `use:` an id listed here (scripts/validate-processly.mjs
 * enforces it). Add a primitive here before a template can use it.
 */
window.PROCESSLY_PRIMITIVES = {
  categories: [
    { id: 'trigger', label: 'Triggers' },
    { id: 'ai',      label: 'AI actions' },
    { id: 'data',    label: 'Data actions' },
    { id: 'action',  label: 'Business actions' },
    { id: 'control', label: 'Control flow' }
  ],
  primitives: [
    { id: 'trigger.form',     cat: 'trigger', label: 'Web form',            desc: 'A website or landing-page form is submitted.' },
    { id: 'trigger.whatsapp', cat: 'trigger', label: 'WhatsApp message',    desc: 'An inbound WhatsApp Business message: text, image or voice note.' },
    { id: 'trigger.email',    cat: 'trigger', label: 'Email received',      desc: 'A message lands in a watched inbox.' },
    { id: 'trigger.api',      cat: 'trigger', label: 'API / webhook',       desc: 'An event from a connected system: payment failed, quote sent, client onboarded.' },
    { id: 'trigger.schedule', cat: 'trigger', label: 'Schedule',            desc: 'Runs on a timetable: daily, weekly or a cron expression.' },
    { id: 'trigger.file',     cat: 'trigger', label: 'File upload',         desc: 'A document arrives through an upload link or as an email attachment.' },
    { id: 'trigger.db_event', cat: 'trigger', label: 'Database event',      desc: 'A record is created or changes state in a table you own.' },

    { id: 'ai.extract',   cat: 'ai', label: 'Extract information', desc: 'Pull structured fields out of free text, photos, PDFs or voice notes.' },
    { id: 'ai.classify',  cat: 'ai', label: 'Classify',            desc: 'Sort an input into one of a fixed set of labels.' },
    { id: 'ai.summarize', cat: 'ai', label: 'Summarize',           desc: 'Condense data or documents into a short brief.' },
    { id: 'ai.generate',  cat: 'ai', label: 'Generate response',   desc: 'Draft a message or document in your tone of voice.' },
    { id: 'ai.qualify',   cat: 'ai', label: 'Qualify / score',     desc: 'Score an input against a written rubric.' },
    { id: 'ai.translate', cat: 'ai', label: 'Translate',           desc: 'Reply in the customer\'s own language.' },
    { id: 'ai.sentiment', cat: 'ai', label: 'Detect sentiment',    desc: 'Detect tone, urgency and frustration.' },
    { id: 'ai.decide',    cat: 'ai', label: 'Structured decision', desc: 'Choose from a fixed catalog by weighted criteria, with reasons.' },

    { id: 'data.validate',  cat: 'data', label: 'Validate',    desc: 'Check inputs against business rules before anything acts on them.' },
    { id: 'data.transform', cat: 'data', label: 'Transform',   desc: 'Normalize, reshape or compute fields.' },
    { id: 'data.dedupe',    cat: 'data', label: 'Deduplicate', desc: 'Merge repeat contacts and events arriving from different channels.' },
    { id: 'data.enrich',    cat: 'data', label: 'Enrich',      desc: 'Add context from other systems: history, tracking, price lists.' },
    { id: 'data.store',     cat: 'data', label: 'Store',       desc: 'Save files and records where they belong, named consistently.' },
    { id: 'data.query',     cat: 'data', label: 'Query',       desc: 'Look up records: orders, invoices, waitlists, catalogs.' },

    { id: 'send.email',       cat: 'action', label: 'Send email',              desc: 'Send an email from your own domain, with attachments.' },
    { id: 'send.whatsapp',    cat: 'action', label: 'Send WhatsApp',           desc: 'Send a WhatsApp Business message, template or reply buttons.' },
    { id: 'crm.create',       cat: 'action', label: 'Create CRM record',       desc: 'Create a lead, deal, candidate or contact.' },
    { id: 'crm.update',       cat: 'action', label: 'Update CRM',              desc: 'Move a stage, set a field or log activity.' },
    { id: 'task.create',      cat: 'action', label: 'Create task',             desc: 'Hand a job to a person, with context attached.' },
    { id: 'calendar.book',    cat: 'action', label: 'Schedule appointment',    desc: 'Book, hold or release calendar slots.' },
    { id: 'doc.generate',     cat: 'action', label: 'Generate document',       desc: 'Produce quotes, invoices, reports and packs from templates.' },
    { id: 'notify.team',      cat: 'action', label: 'Notify team',             desc: 'Alert staff on Slack, WhatsApp or email.' },
    { id: 'integration.call', cat: 'action', label: 'Call connected system',   desc: 'Act inside another tool: payments, ERP, PMS, accounting.' },

    { id: 'control.branch',   cat: 'control', label: 'If / else',      desc: 'Take one of two or more paths based on a condition.' },
    { id: 'control.switch',   cat: 'control', label: 'Switch',         desc: 'Route by value into several labelled paths.' },
    { id: 'control.loop',     cat: 'control', label: 'Loop',           desc: 'Repeat steps for each item, or on a cadence until a condition is met.' },
    { id: 'control.wait',     cat: 'control', label: 'Wait',           desc: 'Pause for a duration or until an event happens.' },
    { id: 'control.retry',    cat: 'control', label: 'Retry',          desc: 'Retry a flaky step on a back-off ladder.' },
    { id: 'control.approval', cat: 'control', label: 'Human approval', desc: 'A person approves before the workflow continues.' }
  ]
};
