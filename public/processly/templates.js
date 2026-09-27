/*
 * Processly industry templates.
 *
 * Each template is pure configuration: a `workflow` built only from primitives
 * in primitives.js, plus a scripted `demo` run. The runner derives the YAML,
 * the workflow map and the progress chips from `workflow`, so they can't drift.
 *
 * Workflow shape
 *   triggers: [{ id?, use: 'trigger.*', ...params }]
 *   steps:    [{ id, label, use, note?, ...params, branches?: [{ when, steps }] }]
 *     - top-level steps need an id and label (they become the progress chips)
 *     - nested steps need an id only if a demo log line points at them
 *     - any other key is a parameter and is rendered into the YAML as-is
 * Demo log lines point at a trigger or step id; exactly one sets `artifact`.
 *
 * All names, numbers and outcomes are illustrative — swap in real client runs.
 * Run `npm run validate:processly` after editing.
 */
window.PROCESSLY_GOALS = [
  { id: 'leads',  label: 'Win more leads' },
  { id: 'retain', label: 'Keep customers' },
  { id: 'cash',   label: 'Get paid' },
  { id: 'ops',    label: 'Run operations' }
];

window.PROCESSLY_TEMPLATES = [
  /* ------------------------------------------------------------ real estate */
  {
    id: 'lead', industry: 'Real estate', goal: 'leads', name: 'The 11pm Lead',
    problem: 'Portal and WhatsApp leads arrive at all hours. A reply within 5 minutes is far more likely to convert than one after 30, but your team replies at 9am.',
    result: 'First reply in 6 seconds, any hour.',
    workflow: {
      name: 'speed-to-lead-realestate', version: 7, mode: 'auto', modeNote: 'promoted after 42 clean review-mode runs',
      triggers: [
        { id: 'wa', use: 'trigger.whatsapp', idempotency_key: 'message_id' },
        { id: 'portal', use: 'trigger.form', source: 'property_portal' }
      ],
      steps: [
        { id: 'normalize', label: 'Normalize', use: 'data.transform', to: 'lead_event', note: 'one shape, whatever the channel' },
        { id: 'dedupe', label: 'Dedupe', use: 'data.dedupe', match_on: ['phone', 'email'] },
        { id: 'extract', label: 'Extract', use: 'ai.extract', fields: ['intent', 'budget', 'area', 'timeline'] },
        { id: 'qualify', label: 'Qualify', use: 'ai.qualify', rubric: 'lead-scoring-v3.md', output: 'lead_score' },
        { id: 'route', label: 'Decide', use: 'control.branch', branches: [
          { when: 'lead_score > 0.7', steps: [
            { id: 'crm', label: 'CRM', use: 'crm.create', stage: 'hot' },
            { id: 'notify', label: 'Ping agent', use: 'notify.team', to: 'area_specialist' },
            { id: 'reply', label: 'Reply', use: 'send.whatsapp', template: 'first_reply_v4' }
          ] },
          { when: 'otherwise', steps: [
            { use: 'crm.create', stage: 'nurture' },
            { use: 'send.email', sequence: 'nurture_6wk' }
          ] }
        ] },
        { id: 'wait', label: 'Wait', use: 'control.wait', for: '24h', skip_if: 'viewing_booked' },
        { id: 'nudge', label: 'Follow-up', use: 'send.whatsapp', template: 'viewing_nudge_v2' }
      ]
    },
    demo: {
      incoming: { meta: 'WhatsApp · 23:47', text: 'Hi! Is the 2BHK in Marina Tower still available? Budget around 130k/yr, looking to move next month. — Sara' },
      artifact: { meta: 'Reply sent · 23:47:06, six seconds later', text: 'Hi Sara! Yes, the 2BHK in Marina Tower is available 😊 1,100 sqft, sea-facing, 130k/yr. I have viewing slots tomorrow at 10:00 or 16:00. Which suits you better? — Rana, Skyline Properties' },
      outcome: '<b>First reply: 6 seconds.</b> Viewing booked at 08:02 the next morning, six hours before the portal\'s next-fastest agent even opened WhatsApp.',
      log: [
        { t: '23:47:01', step: 'wa',        d: 'WhatsApp message received · wa_9f2c' },
        { t: '23:47:01', step: 'normalize', d: 'whatsapp → lead_event {name, phone, text, source}' },
        { t: '23:47:02', step: 'dedupe',    d: 'matched Sara\'s portal enquiry from 21:10 → merged into one lead' },
        { t: '23:47:02', step: 'extract',   d: 'intent: viewing · budget: 130k/yr · area: Marina · timeline: 30 days' },
        { t: '23:47:04', step: 'qualify',   d: 'score 0.87 (HOT) · budget + timeline + exact unit match' },
        { t: '23:47:04', step: 'route',     d: 'lead_score > 0.7 → hot path' },
        { t: '23:47:05', step: 'crm',       d: 'lead #4821 created · stage: hot · owner: Rana' },
        { t: '23:47:05', step: 'notify',    d: 'Rana pinged with a one-line lead summary' },
        { t: '23:47:06', step: 'reply',     d: 'personalised reply sent via WhatsApp Business API', artifact: true },
        { t: '23:47:07', step: 'wait',      d: 'viewing nudge armed for tomorrow 23:47 · skipped if a viewing is booked' }
      ]
    }
  },

  /* ---------------------------------------------------------------- clinics */
  {
    id: 'noshow', industry: 'Clinics', goal: 'ops', name: 'The No-Show Killer',
    problem: 'One in four patients doesn\'t show up. The waitlist that could fill those chairs lives in somebody\'s head.',
    result: 'Empty slot refilled in 39 minutes, hands-free.',
    workflow: {
      name: 'appointment-refill', version: 4, mode: 'auto',
      triggers: [
        { id: 'wa', use: 'trigger.whatsapp', match: ['cancel', 'reschedule'] },
        { id: 'cal', use: 'trigger.db_event', table: 'appointments', on: 'status = cancelled' }
      ],
      steps: [
        { id: 'classify', label: 'Understand', use: 'ai.classify', labels: ['cancel', 'reschedule', 'question'] },
        { id: 'release', label: 'Release', use: 'integration.call', system: 'clinic_calendar', action: 'release_slot' },
        { id: 'match', label: 'Match waitlist', use: 'data.query', from: 'waitlist', match: ['service_type', 'proximity'], limit: 3 },
        { id: 'offer', label: 'Offer', use: 'control.loop', branches: [
          { when: 'for each match', steps: [
            { id: 'send_offer', label: 'Slot offer', use: 'send.whatsapp', template: 'slot_offer', expect: 'yes_no' }
          ] }
        ] },
        { id: 'confirm', label: 'Wait for YES', use: 'control.wait', until: 'first_yes', timeout: '2h' },
        { id: 'book', label: 'Book', use: 'calendar.book', reminders: ['24h', '3h'] },
        { id: 'tidy', label: 'Tidy up', use: 'send.whatsapp', to: 'other_offers', template: 'slot_taken' }
      ]
    },
    demo: {
      incoming: { meta: 'WhatsApp · Thu 09:12', text: 'So sorry, can\'t make Thursday 4pm, something came up at work 😔 — Laila' },
      artifact: { meta: 'WhatsApp to the waitlist · 09:13', text: 'Hi Omar! A slot just opened Thursday 16:00 with Dr. Lena, and you\'re first on the waitlist. Shall I book you in? Reply YES and it\'s yours 🙌' },
      outcome: '<b>Chair refilled in 39 minutes.</b> No-show cost: zero. Front-desk minutes spent: zero.',
      log: [
        { t: 'Thu 09:12', step: 'wa',         d: 'message from Laila re: appt #A1042 (Thu 16:00, Dr. Lena)' },
        { t: '09:12',     step: 'classify',   d: 'intent: cancel (0.96) · no reschedule requested' },
        { t: '09:12',     step: 'release',    d: 'slot Thu 16:00 released in the clinic calendar' },
        { t: '09:13',     step: 'match',      d: '3 waitlist patients match physio follow-up, under 5 km' },
        { t: '09:13',     step: 'send_offer', d: '3 offers sent · first YES wins', artifact: true },
        { t: '09:51',     step: 'confirm',    d: 'Omar replied YES after 38 minutes' },
        { t: '09:51',     step: 'book',       d: 'appointment #A1055 booked · reminders armed for Omar' },
        { t: '09:52',     step: 'tidy',       d: '2 other offers withdrawn politely' }
      ]
    }
  },

  /* -------------------------------------------------------- B2B / services */
  {
    id: 'chaser', industry: 'Any B2B / services', goal: 'cash', name: 'The Polite Chaser',
    problem: 'You hate chasing invoices, so they get chased late, once, apologetically. Cash flow pays the price.',
    result: 'Paid on day 11. Zero awkward calls.',
    workflow: {
      name: 'invoice-chaser', version: 5, mode: 'auto',
      triggers: [{ id: 'daily', use: 'trigger.schedule', daily_at: '09:00' }],
      steps: [
        { id: 'find', label: 'Find overdue', use: 'data.query', from: 'invoices', where: 'status = overdue', skip_if: 'disputed' },
        { id: 'tone', label: 'Pick tone', use: 'control.switch', on: 'days_overdue', branches: [
          { when: '1–7 days', steps: [{ id: 'gentle', label: 'Gentle email', use: 'send.email', tone: 'gentle', attach: ['invoice'] }] },
          { when: '8–13 days', steps: [{ id: 'friendly', label: 'WhatsApp nudge', use: 'send.whatsapp', tone: 'friendly' }] },
          { when: '14–30 days', steps: [
            { use: 'ai.generate', tone: 'firm', include: ['statement', 'payment_link'] },
            { use: 'control.approval', who: 'owner' },
            { use: 'send.email', cc: 'accounts' }
          ] },
          { when: '30+ days', steps: [{ use: 'task.create', for: 'owner', title: 'Call the client' }] }
        ] },
        { id: 'reconcile', label: 'Reconcile', use: 'integration.call', system: 'accounting', action: 'match_payments', note: 'paid → stop chasing + thank-you' }
      ]
    },
    demo: {
      incoming: { meta: 'Overdue check · daily 09:00', text: 'Invoice #1042 · $3,480 · due 1 Oct · now 3 days overdue (to: Daniel C.)' },
      artifact: { meta: 'WhatsApp nudge · day 8', text: 'Hi Daniel, floating invoice #1042 ($3,480, due 1 Oct) to the top of your inbox. No stress if it\'s already scheduled, just making sure it didn\'t get buried. Anything unclear, happy to walk through it. — Priya' },
      outcome: '<b>Paid on day 11, zero awkward calls.</b> The tone ladder does the chasing, so your team never has to.',
      log: [
        { t: 'Oct 4 09:00', step: 'daily',     d: 'daily overdue check started' },
        { t: '09:00',       step: 'find',      d: '1 match: #1042 · Daniel C. · +3 days · no dispute flag' },
        { t: '09:00',       step: 'tone',      d: '3 days overdue → gentle email' },
        { t: '09:01',       step: 'gentle',    d: 'nudge #1 sent with invoice attached' },
        { t: 'Oct 9 09:00', step: 'tone',      d: 'still unpaid at +8 days → WhatsApp, friendly' },
        { t: '09:01',       step: 'friendly',  d: 'nudge #2 sent on WhatsApp', artifact: true },
        { t: 'Oct 12 10:22', step: 'reconcile', d: 'payment matched ✓ #1042 marked paid · chasing stopped · thank-you sent' }
      ]
    }
  },

  /* ----------------------------------------------------- contractors/trades */
  {
    id: 'quote', industry: 'Contractors / trades', goal: 'leads', name: 'The Quote Follow-Up Machine',
    problem: 'You send the quote, then… nothing. The job usually goes to whoever follows up, and following up feels like begging.',
    result: 'Four-touch cadence. Job booked day 7.',
    workflow: {
      name: 'quote-followup', version: 3, mode: 'auto',
      triggers: [{ id: 'sent', use: 'trigger.api', event: 'quote.sent', from: 'quoting_tool' }],
      steps: [
        { id: 'cadence', label: 'Cadence', use: 'control.loop', over: ['day_2 value', 'day_4 faq', 'day_7 expiry', 'day_14 breakup'], stop_when: 'reply_received', branches: [
          { when: 'each touch', steps: [
            { use: 'control.wait', until: 'touch.day' },
            { id: 'draft', label: 'Draft touch', use: 'ai.generate', brief: 'touch.brief', proof: 'similar_jobs' },
            { id: 'send', label: 'Send', use: 'send.email' }
          ] }
        ] },
        { id: 'classify', label: 'Read reply', use: 'ai.classify', labels: ['go_ahead', 'questions', 'not_now'] },
        { id: 'close', label: 'Close', use: 'control.switch', on: 'intent', branches: [
          { when: 'go_ahead', steps: [
            { id: 'won', label: 'Mark won', use: 'crm.update', stage: 'won' },
            { id: 'deposit', label: 'Deposit invoice', use: 'doc.generate', template: 'deposit_invoice' },
            { id: 'hold', label: 'Hold start date', use: 'calendar.book', type: 'hold' }
          ] },
          { when: 'questions', steps: [{ use: 'notify.team', to: 'estimator' }] },
          { when: 'not_now', steps: [{ use: 'crm.update', stage: 'revisit_in_60d' }] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'System event · Mon 10:14', text: 'Quote #Q-218 sent to Marcus · $4,200, bathroom refit · follow-up: on' },
      artifact: { meta: 'Email · day 2', text: 'Hi Marcus, following up on your bathroom refit quote ($4,200). We just wrapped a near-identical job on Elm St; photos attached if you\'d like a look. Any questions, or shall I pencil you in for a start date? — Sam, Riverview Bathrooms' },
      outcome: '<b>Job booked on day 7</b>, with the four touches nobody ever gets around to making.',
      log: [
        { t: 'Mon 10:14', step: 'sent',     d: 'quote #Q-218 delivered ($4,200 · bathroom refit)' },
        { t: 'Mon 10:14', step: 'cadence',  d: '4 touches armed: day 2, 4, 7, 14 · stops on any reply' },
        { t: 'Wed 10:15', step: 'draft',    d: 'touch 1 drafted: recap + photos from the Elm St job' },
        { t: 'Wed 10:15', step: 'send',     d: 'touch 1 emailed', artifact: true },
        { t: 'Fri 10:15', step: 'send',     d: 'touch 2 emailed: FAQ + finance options' },
        { t: 'Mon 14:32', step: 'classify', d: 'Marcus replied → go_ahead (0.94) · cadence stopped' },
        { t: '14:33',     step: 'won',      d: 'deal marked won in the CRM' },
        { t: '14:33',     step: 'deposit',  d: 'deposit invoice generated and sent' },
        { t: '14:33',     step: 'hold',     d: 'start date held: Mon 3 Nov' }
      ]
    }
  },

  /* ------------------------------------------------------ education/coaching */
  {
    id: 'admissions', industry: 'Education / coaching', goal: 'leads', name: 'Admissions Overflow',
    problem: 'Admissions season means 100+ enquiries a day. Counsellors drown in triage and leads go cold over the weekend.',
    result: 'Matched, assigned and answered in 38 seconds.',
    workflow: {
      name: 'admissions-overflow', version: 6, mode: 'auto',
      triggers: [
        { id: 'form', use: 'trigger.form', idempotency_key: 'form_id + email' },
        { use: 'trigger.whatsapp' }
      ],
      steps: [
        { id: 'extract', label: 'Extract', use: 'ai.extract', fields: ['interest', 'schedule', 'background', 'budget'] },
        { id: 'match', label: 'Match course', use: 'ai.decide', choose_from: 'programs.yaml', criteria: ['schedule_fit', 'background', 'budget'], top_k: 2 },
        { id: 'assign', label: 'Assign', use: 'data.query', from: 'counsellors', pick: 'least_loaded', prefer: 'matching_background' },
        { id: 'send', label: 'Send', use: 'send.email', attach: ['program.brochure'], include: 'booking_link' },
        { id: 'booked', label: 'Booked?', use: 'control.branch', branches: [
          { when: 'consult booked', steps: [{ id: 'remind', label: 'Reminders', use: 'calendar.book', reminders: ['24h', '1h'] }] },
          { when: 'no booking in 48h', steps: [{ use: 'send.whatsapp', template: 'consult_nudge' }] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'Website form · 18:32', text: 'Hi, interested in the Data Analytics course. I work in banking, can only study evenings. — Ahmed' },
      artifact: { meta: 'Email · 38 seconds later', text: 'Hi Ahmed, great fit: our Data Analytics evening track was built for banking professionals (92% of modules run after 6pm). Brochure attached. If you\'d like a 20-minute chat, Nadia, our finance-careers counsellor, has Tuesday 18:30 open: [book].' },
      outcome: '<b>Answered in 38 seconds at 6:32pm.</b> Met the counsellor Tuesday. Enrolled Friday.',
      log: [
        { t: '18:32:41', step: 'form',    d: 'form enquiry received · form_7731' },
        { t: '18:32:43', step: 'extract', d: 'interest: data analytics · schedule: evenings · background: banking' },
        { t: '18:33:02', step: 'match',   d: 'Data Analytics (evening) 92% · AI for Finance 87%' },
        { t: '18:33:03', step: 'assign',  d: 'counsellor: Nadia · lowest load, finance background' },
        { t: '18:33:19', step: 'send',    d: 'brochure + evening timetable + Nadia\'s booking link', artifact: true },
        { t: '19:10:22', step: 'remind',  d: 'consult booked Tue 18:30 · reminders at 24h and 1h' }
      ]
    }
  },

  /* ------------------------------------------------------------ any business */
  {
    id: 'report', industry: 'Any business', goal: 'ops', name: 'The Monday Report',
    problem: 'Every Monday, someone burns two hours copy-pasting from five tabs into a report nobody enjoys making.',
    result: 'Report lands before anyone arrives.',
    workflow: {
      name: 'weekly-report', version: 9, mode: 'auto',
      triggers: [{ id: 'cron', use: 'trigger.schedule', cron: '0 8 * * MON' }],
      steps: [
        { id: 'collect', label: 'Collect', use: 'data.query', sources: ['crm.leads', 'sheets.enrolments', 'whatsapp.stats', 'ads.spend'] },
        { id: 'aggregate', label: 'Aggregate', use: 'data.transform', metrics: ['cost_per_lead', 'conversion_rate', 'channel_rank'] },
        { id: 'summarize', label: 'Summarize', use: 'ai.summarize', style: 'executive', flags: ['anomalies', 'underperformers'] },
        { id: 'pdf', label: 'Build PDF', use: 'doc.generate', template: 'weekly_report_v2' },
        { id: 'deliver', label: 'Deliver', use: 'send.email', to: ['owner', 'sales', 'marketing'] }
      ]
    },
    demo: {
      incoming: { meta: 'Schedule · every Monday 08:00', text: 'Weekly business report · sources: CRM, enrolments sheet, WhatsApp, ad spend.' },
      artifact: { meta: 'Email · 08:00, before anyone arrives', text: 'Weekly recap, Oct 7. 38 new leads (+12%), 12 enrolments. WhatsApp is still your best channel at $31/lead vs $67 from ads; consider shifting budget. ⚠ Flag: 5 leads from Thursday\'s campaign had invalid numbers; recommend pausing that ad set. Full breakdown attached.' },
      outcome: '<b>Two hours reclaimed, every week.</b> The report nobody had time to make, made before coffee.',
      log: [
        { t: '08:00:00', step: 'cron',      d: 'weekly report triggered (0 8 * * MON)' },
        { t: '08:00:04', step: 'collect',   d: '38 leads (CRM) · 12 enrolments (Sheets) · 214 chats (WhatsApp) · $1,840 (ads)' },
        { t: '08:00:07', step: 'aggregate', d: 'cost/lead $48.40 · conversion 31.6% · top channel: WhatsApp ($31/lead)' },
        { t: '08:00:11', step: 'summarize', d: 'exec summary drafted + 3 flags', artifact: true },
        { t: '08:00:12', step: 'pdf',       d: 'PDF built with charts and appendix' },
        { t: '08:00:13', step: 'deliver',   d: 'emailed to owner, sales, marketing' }
      ]
    }
  },

  /* -------------------------------------------------- memberships/subscriptions */
  {
    id: 'churn', industry: 'Memberships / subscriptions', goal: 'cash', name: 'The Silent Churn Rescuer',
    problem: 'Failed card payments quietly end memberships. By the time anyone notices, the member is long gone.',
    result: 'Card updated on day 4. Membership saved.',
    workflow: {
      name: 'failed-payment-rescue', version: 4, mode: 'auto',
      triggers: [{ id: 'failed', use: 'trigger.api', event: 'payment.failed', from: 'stripe' }],
      steps: [
        { id: 'retry', label: 'Retry', use: 'control.retry', ladder: ['immediate', '24h', '3d'], branches: [
          { when: 'each attempt', steps: [{ id: 'charge', label: 'Charge', use: 'integration.call', system: 'stripe', action: 'retry_charge' }] }
        ] },
        { id: 'notify', label: 'Notify', use: 'send.whatsapp', template: 'card_update_link', fallback: 'email' },
        { id: 'wait', label: 'Wait', use: 'control.wait', for: '48h', until: 'card_updated' },
        { id: 'save', label: 'Save', use: 'control.branch', branches: [
          { when: 'card updated', steps: [{ id: 'active', label: 'Reactivate', use: 'crm.update', status: 'active' }] },
          { when: 'no update after 48h', steps: [
            { id: 'winback', label: 'Win-back offer', use: 'ai.generate', offer: 'pause_one_month' },
            { use: 'send.whatsapp' }
          ] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'System event · 03:12', text: 'Payment failed · member #M-214 (Sarah K.) · card ending 4471 expired.' },
      artifact: { meta: 'WhatsApp · morning after', text: 'Hi Sarah, your card ending 4471 expired, so this month\'s payment didn\'t go through. No stress: update it here [secure link] and everything continues as normal. Rather pause a month? Just reply PAUSE and your streak stays.' },
      outcome: '<b>Membership saved on day 4</b>, without a single awkward call.',
      log: [
        { t: '03:12',         step: 'failed',  d: 'payment declined · reason: card_expired' },
        { t: '03:12',         step: 'charge',  d: 'smart retry #1 declined · next attempt in 24h' },
        { t: '08:30',         step: 'notify',  d: 'WhatsApp + email with secure card-update link', artifact: true },
        { t: '+48h',          step: 'winback', d: 'no update → pause-one-month offer sent' },
        { t: 'Day 4 · 09:41', step: 'active',  d: 'card updated ✓ payment retried ✓ membership active' }
      ]
    }
  },

  /* ----------------------------------------------------------- local services */
  {
    id: 'reviews', industry: 'Local services', goal: 'retain', name: 'The Review Harvester',
    problem: 'Happy customers mean to leave a review and never do. Unhappy ones find Google within the hour.',
    result: 'The 5★ went to Google. The 2★ went to the manager.',
    workflow: {
      name: 'review-harvester', version: 5, mode: 'auto', modeNote: 'the ask is automatic; recovery replies stay gated',
      triggers: [{ id: 'done', use: 'trigger.db_event', table: 'jobs', on: 'status = complete' }],
      steps: [
        { id: 'wait', label: 'Wait', use: 'control.wait', for: '24h' },
        { id: 'ask', label: 'Ask', use: 'send.whatsapp', template: 'how_did_we_do_v3', expect: 'rating_1_5' },
        { id: 'read', label: 'Read reply', use: 'ai.sentiment', output: ['rating', 'tone'] },
        { id: 'rating', label: 'Route', use: 'control.switch', on: 'rating', branches: [
          { when: '4–5★', steps: [{ id: 'google', label: 'Google link', use: 'send.whatsapp', link: 'google.one_tap', include: 'referral_code' }] },
          { when: '1–3★', steps: [
            { id: 'alert', label: 'Alert manager', use: 'notify.team', to: 'manager' },
            { id: 'draft', label: 'Draft recovery', use: 'ai.generate', tone: 'apologetic' },
            { id: 'approve', label: 'Approval', use: 'control.approval', who: 'manager', note: 'a human approves before sending' }
          ] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'System event · Tue 10:00', text: 'Job #771 (AC service, Fatima R.) marked complete.' },
      artifact: { meta: 'WhatsApp · 24h after the job', text: 'Hi Fatima, hope the AC is running ice-cold 😎 Quick one: how did we do, 1 to 5? If anything fell short, tell us here and we\'ll fix it first.' },
      outcome: '<b>The 5★ went to Google with a one-tap link.</b> The 2★ never reached Google. It reached the manager\'s phone in 40 seconds, with a drafted reply awaiting approval.',
      log: [
        { t: 'Tue 10:00', step: 'done',    d: 'job #771 complete (AC service · Fatima R.)' },
        { t: 'Wed 10:00', step: 'wait',    d: '24h passed' },
        { t: 'Wed 10:00', step: 'ask',     d: 'rating request sent', artifact: true },
        { t: 'Wed 10:07', step: 'read',    d: '"5! technician was great" → rating 5 · positive (0.97)' },
        { t: 'Wed 10:07', step: 'google',  d: 'one-tap Google review link + referral code sent' },
        { t: 'Thu 16:40', step: 'rating',  d: 'job #779 replied 2★ → private path' },
        { t: 'Thu 16:40', step: 'alert',   d: 'manager alerted in 40 seconds' },
        { t: 'Thu 16:41', step: 'draft',   d: 'recovery reply drafted' },
        { t: 'Thu 16:41', step: 'approve', d: 'waiting on the manager\'s approval' }
      ]
    }
  },

  /* ---------------------------------------------------- restaurants/catering */
  {
    id: 'catering', industry: 'Restaurants / catering', goal: 'leads', name: 'The 12-Minute Catering Quote',
    problem: 'Catering enquiries land in email, DMs and forms. Pricing one eats the manager\'s evening, so half get answered after the client has booked someone else.',
    result: 'Priced, approved and sent in 12 minutes.',
    workflow: {
      name: 'catering-quote', version: 2, mode: 'auto', modeNote: 'every quote still passes the manager',
      triggers: [
        { id: 'mail', use: 'trigger.email', inbox: 'events@' },
        { use: 'trigger.whatsapp' },
        { use: 'trigger.form', source: 'catering_page' }
      ],
      steps: [
        { id: 'extract', label: 'Extract', use: 'ai.extract', fields: ['date', 'headcount', 'budget', 'dietary', 'venue'] },
        { id: 'validate', label: 'Validate', use: 'data.validate', rules: ['date ≥ 7 days out', 'headcount 20–300'] },
        { id: 'capacity', label: 'Check capacity', use: 'data.query', from: 'events_calendar', on: 'date' },
        { id: 'quote', label: 'Build quote', use: 'doc.generate', template: 'catering_quote_v3', prices: 'menu_pricing.csv' },
        { id: 'approve', label: 'Approval', use: 'control.approval', who: 'manager', via: 'whatsapp', timeout: '2h' },
        { id: 'send', label: 'Send', use: 'send.email', attach: ['quote', 'menu'] },
        { id: 'crm', label: 'CRM', use: 'crm.create', stage: 'quoted' },
        { id: 'follow', label: 'Follow-up', use: 'control.wait', for: '3d', then: 'send.whatsapp quote_check_in' }
      ]
    },
    demo: {
      incoming: { meta: 'Email · Fri 19:04', text: 'Hi, we need catering for 60 on 14 Dec, office party, around $2.5k. 8 vegetarians. Can you do it? — Hana, Northwind Ltd' },
      artifact: { meta: 'Email · 12 minutes after the enquiry', text: 'Hi Hana, yes, 14 Dec is open! Attached is our Festive Buffet for 60 at $41/head ($2,460 total), with a full vegetarian station for your 8 (and anyone else who wanders over). Menu and quote attached; happy to tweak. Shall I hold the date? — Leo, Olive & Ember Catering' },
      outcome: '<b>Quoted in 12 minutes, on a Friday night.</b> Hana signed Monday. The two caterers she\'d also emailed replied Tuesday.',
      log: [
        { t: 'Fri 19:04', step: 'mail',     d: 'enquiry received at events@ from Northwind Ltd' },
        { t: '19:04',     step: 'extract',  d: 'date 14 Dec · 60 guests · budget $2,500 · 8 veg · venue: client office' },
        { t: '19:04',     step: 'validate', d: '✓ 30 days out · ✓ within 20–300 guests' },
        { t: '19:05',     step: 'capacity', d: 'kitchen free on 14 Dec · one smaller event, capacity OK' },
        { t: '19:05',     step: 'quote',    d: 'quote #C-311: Festive Buffet · $41/head · $2,460' },
        { t: '19:14',     step: 'approve',  d: 'manager approved on WhatsApp after swapping one dessert' },
        { t: '19:16',     step: 'send',     d: 'quote + menu emailed to Hana', artifact: true },
        { t: '19:16',     step: 'crm',      d: 'deal created · $2,460 · stage: quoted' }
      ]
    }
  },

  /* ------------------------------------------------------------- e-commerce */
  {
    id: 'wismo', industry: 'E-commerce', goal: 'ops', name: 'Where\'s My Order?',
    problem: 'Most of your support inbox is "where\'s my order?". Every one costs an agent three minutes of tab-switching, often in a language they don\'t speak.',
    result: 'Answered in 6 seconds, in Spanish, no agent.',
    workflow: {
      name: 'order-status-deflection', version: 8, mode: 'auto',
      triggers: [
        { id: 'wa', use: 'trigger.whatsapp' },
        { use: 'trigger.email', inbox: 'support@' }
      ],
      steps: [
        { id: 'classify', label: 'Classify', use: 'ai.classify', labels: ['order_status', 'return', 'complaint', 'other'], detect: 'language' },
        { id: 'mood', label: 'Sentiment', use: 'ai.sentiment', escalate_if: 'angry' },
        { id: 'route', label: 'Route', use: 'control.switch', on: 'intent', branches: [
          { when: 'order_status', steps: [
            { id: 'lookup', label: 'Find order', use: 'data.query', from: 'orders', match: ['order_no', 'phone'] },
            { id: 'track', label: 'Tracking', use: 'data.enrich', with: 'carrier_tracking' },
            { id: 'write', label: 'Write answer', use: 'ai.generate', tone: 'brand_voice' },
            { id: 'translate', label: 'Translate', use: 'ai.translate', to: 'customer.language' },
            { id: 'reply', label: 'Reply', use: 'send.whatsapp' }
          ] },
          { when: 'return', steps: [
            { use: 'doc.generate', template: 'return_label' },
            { use: 'send.whatsapp' }
          ] },
          { when: 'complaint or angry', steps: [
            { use: 'ai.summarize', for: 'agent' },
            { use: 'task.create', queue: 'helpdesk', priority: 'high' }
          ] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'WhatsApp · 14:02', text: 'hola, dónde está mi pedido? #58213 — Lucía' },
      artifact: { meta: 'WhatsApp · 6 seconds later, in Spanish', text: '¡Hola Lucía! Tu pedido #58213 salió el martes y hoy está en reparto con DHL 🚚 Llega entre las 16:00 y las 18:00. Seguimiento: [enlace]' },
      outcome: '<b>Answered in 6 seconds, in Spanish, with no agent involved.</b> Your team only sees complaints: flagged, prioritised and already summarised.',
      log: [
        { t: '14:02:11', step: 'wa',        d: 'WhatsApp message received' },
        { t: '14:02:12', step: 'classify',  d: 'intent: order_status (0.98) · language: es' },
        { t: '14:02:12', step: 'mood',      d: 'neutral · no escalation' },
        { t: '14:02:13', step: 'lookup',    d: 'order #58213 · 2 items · shipped Tue' },
        { t: '14:02:15', step: 'track',     d: 'DHL: out for delivery · ETA today 16:00–18:00' },
        { t: '14:02:16', step: 'write',     d: 'answer drafted in brand voice' },
        { t: '14:02:16', step: 'translate', d: 'translated to Spanish' },
        { t: '14:02:17', step: 'reply',     d: 'reply sent', artifact: true }
      ]
    }
  },

  /* ------------------------------------------------------- accounting / legal */
  {
    id: 'docs', industry: 'Accounting / legal', goal: 'ops', name: 'The Document Chaser',
    problem: 'Every new client means chasing a dozen documents across weeks of emails. Your accountants spend Mondays asking for bank statements instead of doing accounts.',
    result: 'Checklist complete on day 9, untouched by staff.',
    workflow: {
      name: 'client-document-collection', version: 3, mode: 'auto',
      triggers: [
        { id: 'onboard', use: 'trigger.api', event: 'client.onboarded', from: 'practice_manager' },
        { id: 'upload', use: 'trigger.file', sources: ['upload_link', 'email_attachments'] }
      ],
      steps: [
        { id: 'checklist', label: 'Checklist', use: 'data.query', from: 'checklists', for: 'client.type' },
        { id: 'classify', label: 'Identify doc', use: 'ai.classify', labels: 'checklist.items' },
        { id: 'validate', label: 'Validate', use: 'data.validate', rules: ['covers the full period', 'legible', 'not a duplicate'] },
        { id: 'store', label: 'File it', use: 'data.store', to: 'client_folder', name_as: '{type}_{period}' },
        { id: 'chase', label: 'Chase', use: 'control.loop', every: '3 days', while: 'items_missing', branches: [
          { when: 'each round', steps: [{ id: 'remind', label: 'Reminder', use: 'send.email', list: 'missing_items' }] }
        ] },
        { id: 'handoff', label: 'Hand off', use: 'task.create', for: 'assigned_accountant', when: 'checklist complete' }
      ]
    },
    demo: {
      incoming: { meta: 'System event · Day 1 09:00', text: 'New client onboarded: Orchard Bakery Ltd · limited company · FY24 accounts' },
      artifact: { meta: 'Email · day 4 reminder', text: 'Hi Tom, thanks for the uploads, you\'re 8 of 12 done 🎉 Still needed: bank statements Oct–Mar (account ending 4410), your Q4 VAT return, the payroll summary and the van lease agreement. Same link as before: [upload]. Phone photos are fine.' },
      outcome: '<b>All 12 documents in by day 9.</b> Priya\'s first touch was a ready-to-start task, with everything already filed and named.',
      log: [
        { t: 'Day 1 09:00', step: 'onboard',   d: 'Orchard Bakery Ltd · type: limited company' },
        { t: '09:00',       step: 'checklist', d: '12 documents required · welcome email + upload link sent' },
        { t: 'Day 2 21:14', step: 'upload',    d: '"scan_0012.pdf" (7 pages) uploaded' },
        { t: '21:14',       step: 'classify',  d: '→ bank statements, account ending 4410' },
        { t: '21:14',       step: 'validate',  d: '⚠ covers Apr–Sep only · Oct–Mar still needed' },
        { t: '21:15',       step: 'store',     d: 'filed as bank_statements_2024-04_2024-09.pdf' },
        { t: 'Day 4 09:00', step: 'remind',    d: '4 of 12 still missing · listed by name', artifact: true },
        { t: 'Day 9 11:20', step: 'handoff',   d: '12/12 ✓ task for Priya: "Start FY24 accounts"' }
      ]
    }
  },

  /* ------------------------------------------------------------ recruitment */
  {
    id: 'screener', industry: 'Recruitment / HR', goal: 'ops', name: 'The Candidate Screener',
    problem: 'Three hundred applications for one role. The best candidate applied on day one and accepted another offer before anyone opened the inbox.',
    result: 'Top candidate invited in 2 minutes.',
    workflow: {
      name: 'candidate-screening', version: 2, mode: 'review', modeNote: 'hiring decisions: a person signs off every rejection',
      triggers: [
        { id: 'mail', use: 'trigger.email', inbox: 'jobs@' },
        { use: 'trigger.form', source: 'careers_page' }
      ],
      steps: [
        { id: 'extract', label: 'Read CV', use: 'ai.extract', fields: ['experience_years', 'skills', 'location', 'notice_period'] },
        { id: 'dedupe', label: 'Dedupe', use: 'data.dedupe', match_on: ['email', 'phone'] },
        { id: 'score', label: 'Score', use: 'ai.qualify', rubric: 'scorecard_ops_manager.md' },
        { id: 'route', label: 'Route', use: 'control.switch', on: 'score', branches: [
          { when: '≥ 0.8', steps: [
            { id: 'ats', label: 'ATS', use: 'crm.create', stage: 'shortlist' },
            { id: 'invite', label: 'Invite', use: 'send.email', template: 'interview_invite', slots: 3 },
            { id: 'book', label: 'Book', use: 'calendar.book', with: 'hiring_manager' }
          ] },
          { when: '0.5–0.8', steps: [{ use: 'task.create', for: 'recruiter', title: 'Review borderline CV' }] },
          { when: '< 0.5', steps: [
            { use: 'ai.generate', template: 'kind_rejection' },
            { id: 'batch', label: 'Batch approval', use: 'control.approval', who: 'recruiter', batch: 'weekly' },
            { use: 'send.email' }
          ] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'Email to jobs@ · Mon 08:12', text: 'Application: Operations Manager · Dana K. · CV attached (2 pages)' },
      artifact: { meta: 'Email · 2 minutes after applying', text: 'Hi Dana, thanks for applying for Operations Manager. Your warehouse-systems background is exactly what we\'re after. Could you do a 30-minute call with Maya, our Head of Ops? Pick a slot: Tue 10:00 · Wed 11:00 · Thu 15:00 [book].' },
      outcome: '<b>Invited two minutes after applying; interview on Wednesday.</b> The 41 low-fit applicants got a kind, personal no, approved in one batch.',
      log: [
        { t: 'Mon 08:12', step: 'mail',    d: 'application #214 · Dana K. · CV.pdf' },
        { t: '08:12',     step: 'extract', d: '7 yrs ops · WMS + lean · Dubai · 30-day notice' },
        { t: '08:12',     step: 'dedupe',  d: 'new candidate' },
        { t: '08:13',     step: 'score',   d: '0.86 against the Ops Manager scorecard · top 5%' },
        { t: '08:13',     step: 'route',   d: '≥ 0.8 → shortlist' },
        { t: '08:13',     step: 'ats',     d: 'added to ATS · stage: shortlist' },
        { t: '08:14',     step: 'invite',  d: 'interview invite with 3 slots sent', artifact: true },
        { t: 'Tue 09:02', step: 'book',    d: 'Dana picked Wed 11:00 · Maya\'s calendar updated' },
        { t: 'Fri 17:00', step: 'batch',   d: '41 rejections drafted · approved by the recruiter in one pass' }
      ]
    }
  },

  /* -------------------------------------------------------------- insurance */
  {
    id: 'renewals', industry: 'Insurance brokers', goal: 'retain', name: 'The Renewal Radar',
    problem: 'Policies roll over straight into the insurer\'s price rise. A client who hears nothing at renewal time is a client quietly shopping around.',
    result: 'Every renewal contacted 45 days out, with a better price.',
    workflow: {
      name: 'renewal-radar', version: 1, mode: 'review', modeNote: 'new: stays in review until 30 clean runs',
      triggers: [{ id: 'daily', use: 'trigger.schedule', daily_at: '07:00' }],
      steps: [
        { id: 'find', label: 'Find renewals', use: 'data.query', from: 'policies', where: 'renews_in = 45 days' },
        { id: 'enrich', label: 'Enrich', use: 'data.enrich', with: ['claims_history', 'renewal_premium'] },
        { id: 'requote', label: 'Requote', use: 'integration.call', system: 'quote_engine', action: 'requote', insurers: 3 },
        { id: 'summarize', label: 'Compare', use: 'ai.summarize', style: 'plain-English comparison' },
        { id: 'pack', label: 'Renewal pack', use: 'doc.generate', template: 'renewal_pack' },
        { id: 'approve', label: 'Approval', use: 'control.approval', who: 'account_broker', timeout: '1 business day' },
        { id: 'send', label: 'Send', use: 'send.whatsapp', fallback: 'email' },
        { id: 'wait', label: 'Wait', use: 'control.wait', for: '7d', until: 'reply' },
        { id: 'next', label: 'Next step', use: 'control.branch', branches: [
          { when: 'client replied', steps: [{ id: 'act', label: 'Broker task', use: 'task.create', title: 'Action client decision' }] },
          { when: 'silent after 7 days', steps: [{ use: 'task.create', title: 'Call before renewal' }] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'Schedule · daily 07:00', text: 'Renewal scan · policies renewing in 45 days.' },
      artifact: { meta: 'WhatsApp · 45 days before renewal', text: 'Hi Aisha, your home & motor policies renew on 12 Nov and your insurer\'s price is up 14% ($2,540). We\'ve found the same cover for $2,228, saving $312. One-page comparison attached. Switch, or stick? Just reply here. — Sam, Harbour Brokers' },
      outcome: '<b>Renewal kept and upgraded to a conversation.</b> The broker spent 3 minutes approving packs, not 3 hours building comparisons.',
      log: [
        { t: '07:00',       step: 'daily',     d: 'daily renewal scan' },
        { t: '07:00',       step: 'find',      d: '6 policies renew in 45 days' },
        { t: '07:01',       step: 'enrich',    d: 'Khan family · home + motor · 0 claims · insurer +14%' },
        { t: '07:03',       step: 'requote',   d: '3 requotes · best saves $312/yr for the same cover' },
        { t: '07:03',       step: 'summarize', d: 'plain-English comparison drafted' },
        { t: '07:04',       step: 'pack',      d: '6 renewal packs generated' },
        { t: '09:31',       step: 'approve',   d: 'Sam approved all 6 packs' },
        { t: '09:32',       step: 'send',      d: 'pack sent to Aisha Khan', artifact: true },
        { t: 'Day 3 14:10', step: 'act',       d: 'Aisha replied "switch us" → task: bind new policy' }
      ]
    }
  },

  /* ------------------------------------------------------------- automotive */
  {
    id: 'service', industry: 'Automotive service', goal: 'retain', name: 'The Service Reminder',
    problem: 'Your customers\' cars are due for a service. They just don\'t know it, so they go to whichever garage they drive past first.',
    result: 'Reminder to booking in 25 minutes.',
    workflow: {
      name: 'service-due-reminder', version: 3, mode: 'auto',
      triggers: [{ id: 'daily', use: 'trigger.schedule', daily_at: '10:00' }],
      steps: [
        { id: 'due', label: 'Find due', use: 'data.query', from: 'vehicles', where: 'service due within 14 days' },
        { id: 'estimate', label: 'Estimate km', use: 'data.transform', compute: 'mileage from the last 2 visits' },
        { id: 'write', label: 'Personalise', use: 'ai.generate', mention: ['car', 'last_service', 'advisor'] },
        { id: 'send', label: 'Send', use: 'send.whatsapp', buttons: ['Book', 'Later'] },
        { id: 'reply', label: 'Reply', use: 'control.switch', on: 'button', branches: [
          { when: 'Book', steps: [{ id: 'book', label: 'Book bay', use: 'calendar.book', slots: 'workshop_capacity', add: 'courtesy_car' }] },
          { when: 'Later', steps: [{ use: 'control.wait', for: '14d', then: 'resend' }] },
          { when: 'no reply', steps: [{ use: 'control.wait', for: '5d', then: 'send.email reminder' }] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'Schedule · daily 10:00', text: 'Due-service scan · all customer vehicles.' },
      artifact: { meta: 'WhatsApp · 10:01', text: 'Hi Khalid, by our estimate your RAV4 is just about at 30,000 km, so its major service is due 🔧 Last time was 14 months ago with Joe. We have Saturday 09:00 or Tuesday 08:00. Tap Book and we\'ll hold one, courtesy car included.' },
      outcome: '<b>Reminder to booked bay in 25 minutes.</b> A service that would have gone to the garage down the road.',
      log: [
        { t: '10:00', step: 'daily',    d: 'daily due-service scan' },
        { t: '10:00', step: 'due',      d: '23 vehicles due in the next 14 days' },
        { t: '10:00', step: 'estimate', d: 'Toyota RAV4 (Khalid M.): est. 29,700 km · 30k service due' },
        { t: '10:01', step: 'write',    d: 'reminder personalised: 30k service, advisor Joe' },
        { t: '10:01', step: 'send',     d: 'WhatsApp with Book / Later buttons', artifact: true },
        { t: '10:26', step: 'reply',    d: 'Khalid tapped Book' },
        { t: '10:26', step: 'book',     d: 'Sat 09:00 booked · courtesy car reserved' }
      ]
    }
  },

  /* ----------------------------------------------------------------- hotels */
  {
    id: 'concierge', industry: 'Hotels / hospitality', goal: 'retain', name: 'The Pre-Arrival Concierge',
    problem: 'Guests arrive knowing nothing about your airport transfer, spa or late checkout, so they never buy them. The front desk is too busy to ask.',
    result: 'Add-ons sold before check-in, in the guest\'s language.',
    workflow: {
      name: 'pre-arrival-upsell', version: 2, mode: 'auto',
      triggers: [{ id: 'booking', use: 'trigger.db_event', table: 'reservations', on: 'created' }],
      steps: [
        { id: 'wait', label: 'Wait', use: 'control.wait', until: 'arrival − 3 days' },
        { id: 'profile', label: 'Profile guest', use: 'data.enrich', with: ['past_stays', 'flight', 'occasion'] },
        { id: 'pick', label: 'Pick offers', use: 'ai.decide', choose_from: 'upsell_catalog', max: 2 },
        { id: 'write', label: 'Write', use: 'ai.generate', tone: 'warm' },
        { id: 'translate', label: 'Translate', use: 'ai.translate', to: 'guest.language' },
        { id: 'send', label: 'Send', use: 'send.whatsapp' },
        { id: 'reply', label: 'Reply', use: 'control.branch', branches: [
          { when: 'accepts', steps: [
            { id: 'folio', label: 'Add to folio', use: 'integration.call', system: 'pms', action: 'add_charge' },
            { id: 'desk', label: 'Brief desk', use: 'notify.team', to: 'front_desk' }
          ] },
          { when: 'asks a question', steps: [{ use: 'notify.team', to: 'concierge' }] }
        ] }
      ]
    },
    demo: {
      incoming: { meta: 'Booking · Mar 2', text: 'Reservation #H-5521 · Jonas W. · 2 adults · 3 nights · arriving Mar 18 · note: "anniversary"' },
      artifact: { meta: 'WhatsApp · 3 days before arrival, in German', text: 'Hallo Jonas! Wir freuen uns auf Sie am 18. März 🌴 Ihr Flug landet um 22:40. Sollen wir Sie abholen? Transfer: $45. Und zum Jahrestag: Late Check-out bis 14 Uhr für $30. Einfach mit JA antworten.' },
      outcome: '<b>$75 of add-ons sold before check-in.</b> And the front desk knew it was their anniversary before they walked in.',
      log: [
        { t: 'Mar 2 11:40',  step: 'booking',   d: 'reservation #H-5521 created' },
        { t: 'Mar 15 09:00', step: 'wait',      d: 'arrival in 3 days' },
        { t: '09:00',        step: 'profile',   d: 'first stay · lands 22:40 · anniversary noted' },
        { t: '09:00',        step: 'pick',      d: 'airport transfer + late checkout' },
        { t: '09:00',        step: 'write',     d: 'message drafted' },
        { t: '09:00',        step: 'translate', d: 'guest language: German' },
        { t: '09:01',        step: 'send',      d: 'WhatsApp sent', artifact: true },
        { t: '11:17',        step: 'folio',     d: 'Jonas said JA to both · $75 added to folio' },
        { t: '11:17',        step: 'desk',      d: 'front desk briefed: late arrival, anniversary' }
      ]
    }
  },

  /* --------------------------------------------------- wholesale/distribution */
  {
    id: 'orders', industry: 'Wholesale / distribution', goal: 'ops', name: 'Orders by WhatsApp',
    problem: 'Trade customers order by WhatsApp photo, voice note and "same as last week pls". Someone re-types every one into the ERP, and some come out wrong.',
    result: 'Handwritten photo to confirmed ERP order.',
    workflow: {
      name: 'whatsapp-order-intake', version: 5, mode: 'auto',
      triggers: [{ id: 'wa', use: 'trigger.whatsapp', accept: ['text', 'image', 'voice'] }],
      steps: [
        { id: 'extract', label: 'Read order', use: 'ai.extract', fields: ['sku', 'qty'], from: ['text', 'photo', 'voice'] },
        { id: 'match', label: 'Match SKUs', use: 'data.enrich', with: ['catalog', 'customer_price_list', 'order_history'] },
        { id: 'check', label: 'Check', use: 'data.validate', rules: ['in stock', 'within credit limit', 'minimum order'] },
        { id: 'route', label: 'Decide', use: 'control.branch', branches: [
          { when: 'all lines OK', steps: [{ use: 'send.whatsapp', template: 'order_summary', buttons: ['Confirm'] }] },
          { when: 'stock or credit issue', steps: [
            { id: 'suggest', label: 'Suggest fix', use: 'ai.generate', offer: 'substitutes' },
            { id: 'confirm', label: 'Confirm', use: 'send.whatsapp', template: 'order_summary', buttons: ['Confirm'] }
          ] }
        ] },
        { id: 'approve', label: 'Customer OK', use: 'control.wait', until: 'confirm_tapped' },
        { id: 'erp', label: 'ERP order', use: 'integration.call', system: 'erp', action: 'create_sales_order' },
        { id: 'invoice', label: 'Invoice', use: 'doc.generate', template: 'invoice' }
      ]
    },
    demo: {
      incoming: { meta: 'WhatsApp · 06:48', text: '[photo] Handwritten order list, 14 lines · from Al Noor Grocers' },
      artifact: { meta: 'WhatsApp · 60 seconds after the photo', text: 'Morning Rashid 👋 Got your list: 14 items, $1,286. One change: we have 8 of the 10 basmati 5kg, so I\'ve added 4 × 2kg to cover it. Reading "tom paste x?" as tomato paste 400g × 24, same as last time. Tap Confirm and it ships today at 14:00.' },
      outcome: '<b>Photo to confirmed ERP order in 14 minutes</b>, 13 of them spent waiting on the customer\'s breakfast. Nobody re-typed anything.',
      log: [
        { t: '06:48', step: 'wa',      d: 'photo from Al Noor Grocers · handwritten list' },
        { t: '06:48', step: 'extract', d: '14 lines read · 1 unclear: "tom paste x?"' },
        { t: '06:48', step: 'match',   d: '13 SKUs matched · "tom paste" → tomato paste 400g (last ordered × 24)' },
        { t: '06:49', step: 'check',   d: 'credit ✓ · 1 line short: basmati 5kg (8 of 10 in stock)' },
        { t: '06:49', step: 'route',   d: 'stock issue → suggest a fix' },
        { t: '06:49', step: 'suggest', d: 'substitute: + 4 × basmati 2kg' },
        { t: '06:49', step: 'confirm', d: 'order summary sent for confirmation', artifact: true },
        { t: '07:02', step: 'approve', d: 'Rashid tapped Confirm' },
        { t: '07:02', step: 'erp',     d: 'sales order SO-8812 created in the ERP' },
        { t: '07:02', step: 'invoice', d: 'invoice generated · delivery slot today 14:00' }
      ]
    }
  }
];
