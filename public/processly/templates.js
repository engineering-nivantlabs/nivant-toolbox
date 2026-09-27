/*
 * Processly industry templates: the landing-page presentation of each one.
 *
 * The workflow itself is NOT here: `workflow` names a real, executable
 * configuration from the engine (processly/templates/workflows/*.yaml),
 * published to workflows.js by `npm run export:site` in processly/. The map,
 * YAML and progress chips on the page are rendered from that file.
 *
 * `demo` is a scripted replay of one run. Every log line points at a real
 * trigger or step id in the engine workflow; exactly one sets `artifact`.
 * Names, numbers and outcomes are illustrative — swap in real client runs.
 * Run `npm run validate:processly` after editing.
 */
window.PROCESSLY_GOALS = [
  { id: 'leads',  label: 'Win more leads' },
  { id: 'retain', label: 'Keep customers' },
  { id: 'cash',   label: 'Get paid' },
  { id: 'ops',    label: 'Run operations' }
];

window.PROCESSLY_TEMPLATES = [
  {
    id: 'lead', workflow: 'speed-to-lead-realestate', industry: 'Real estate', goal: 'leads', name: 'The 11pm Lead',
    problem: 'Portal and WhatsApp leads arrive at all hours. A reply within 5 minutes is far more likely to convert than one after 30, but your team replies at 9am.',
    result: 'First reply in 6 seconds, any hour.',
    demo: {
      incoming: { meta: 'WhatsApp · 23:47', text: 'Hi! Is the 2BHK in Marina Tower still available? Budget around 130k/yr, looking to move next month. — Sara' },
      artifact: { meta: 'Reply sent · 23:47:06, six seconds later', text: 'Hi Sara! Yes, the 2BHK in Marina Tower is available 😊 1,100 sqft, sea-facing, 130k/yr. I have viewing slots on Tue 10:00 or Wed 10:00. Which suits you better? — Rana, Skyline Properties' },
      outcome: '<b>First reply: 6 seconds.</b> Viewing booked at 08:02 the next morning, six hours before the portal\'s next-fastest agent even opened WhatsApp.',
      log: [
        { t: '23:47:01', step: 'wa',        d: 'WhatsApp message received' },
        { t: '23:47:01', step: 'normalize', d: 'whatsapp → { name, phone, message, channel }' },
        { t: '23:47:02', step: 'dedupe',    d: 'same phone as a portal enquiry at 21:10 → one lead, not two' },
        { t: '23:47:03', step: 'extract',   d: 'intent: viewing · area: Marina · bedrooms: 2 · budget: 130k/yr · timeline: next month' },
        { t: '23:47:03', step: 'listings',  d: 'SQL: 1 available listing matches (Marina Tower 2BHK, 130k)' },
        { t: '23:47:05', step: 'qualify',   d: 'score 0.87 (hot) · exact unit, budget match, 30-day timeline' },
        { t: '23:47:05', step: 'route',     d: 'score ≥ 0.7 → hot path' },
        { t: '23:47:05', step: 'crm',       d: 'lead created · stage: hot · owner: Rana' },
        { t: '23:47:05', step: 'slots',     d: 'next free viewing slots: Tue 10:00, Wed 10:00' },
        { t: '23:47:05', step: 'notify',    d: 'Rana pinged on WhatsApp with a one-line summary' },
        { t: '23:47:06', step: 'draft',     d: 'reply drafted from the listing and the slots' },
        { t: '23:47:06', step: 'reply',     d: 'sent via the WhatsApp Business API', artifact: true },
        { t: '23:47:07', step: 'listen',    d: 'waiting up to 24h for Sara\'s answer, then a gentle nudge' }
      ]
    }
  },

  {
    id: 'noshow', workflow: 'appointment-refill', industry: 'Clinics', goal: 'ops', name: 'The No-Show Killer',
    problem: 'One in four patients doesn\'t show up. The waitlist that could fill those chairs lives in somebody\'s head.',
    result: 'Empty slot refilled in 39 minutes, hands-free.',
    demo: {
      incoming: { meta: 'WhatsApp · Thu 09:12', text: 'So sorry, can\'t make Thursday 4pm, something came up at work 😔 — Laila' },
      artifact: { meta: 'WhatsApp to the waitlist · 09:13', text: 'Hi Omar! A physio follow-up slot just opened with Dr. Lena on Thu 8 Oct, 16:00. You\'re on our waitlist — want it?  [Yes, book me]  [No thanks]' },
      outcome: '<b>Chair refilled in 39 minutes.</b> No-show cost: zero. Front-desk minutes spent: zero.',
      log: [
        { t: 'Thu 09:12', step: 'wa',         d: 'message from Laila' },
        { t: '09:12',     step: 'classify',   d: 'intent: cancel (0.96), not a reschedule' },
        { t: '09:12',     step: 'appt',       d: 'found: Thu 16:00, physio follow-up, Dr. Lena' },
        { t: '09:12',     step: 'release',    d: 'clinic API: slot released' },
        { t: '09:12',     step: 'ack',        d: 'Laila told it\'s cancelled, rebooking any time' },
        { t: '09:13',     step: 'match',      d: '3 waitlist patients for physio follow-up' },
        { t: '09:13',     step: 'send_offer', d: 'offers sent with Yes / No buttons', artifact: true },
        { t: '09:40',     step: 'reply',      d: 'Zara: "No thanks" → keep waiting' },
        { t: '09:51',     step: 'reply',      d: 'Omar: "Yes, book me"' },
        { t: '09:51',     step: 'book',       d: 'clinic API: appointment booked for Omar' },
        { t: '09:51',     step: 'confirm',    d: 'Omar confirmed, reminder to follow' },
        { t: '09:52',     step: 'tidy',       d: 'the others told the slot has gone' }
      ]
    }
  },

  {
    id: 'chaser', workflow: 'invoice-chaser', industry: 'Any B2B / services', goal: 'cash', name: 'The Polite Chaser',
    problem: 'You hate chasing invoices, so they get chased late, once, apologetically. Cash flow pays the price.',
    result: 'Every overdue invoice handled by 9:05.',
    demo: {
      incoming: { meta: 'Schedule · daily 09:00', text: 'Overdue check: open invoices past their due date, excluding disputed ones.' },
      artifact: { meta: 'WhatsApp nudge · invoice 10 days overdue', text: 'Hi Daniel, floating invoice 1002 (USD 3480.00, due 2026-09-25) to the top of your inbox. No stress if it\'s scheduled — just making sure it didn\'t get buried.' },
      outcome: '<b>Five invoices handled before 9:05.</b> The tone ladder did the chasing; the owner made one decision, from her phone.',
      log: [
        { t: '09:00:00', step: 'daily',      d: 'daily run started' },
        { t: '09:00:01', step: 'find',       d: '5 overdue: 3, 5, 10, 20 and 45 days' },
        { t: '09:00:01', step: 'paid',       d: 'accounting API: #1005 already paid' },
        { t: '09:00:02', step: 'mark_paid',  d: '#1005 marked paid, chasing stopped' },
        { t: '09:00:02', step: 'gentle',     d: '#1001 (+3 days) → gentle email' },
        { t: '09:00:03', step: 'friendly',   d: '#1002 Daniel (+10 days) → WhatsApp nudge', artifact: true },
        { t: '09:00:05', step: 'firm_draft', d: '#1003 (+20 days) → firm letter drafted, queued for approval' },
        { t: '09:00:05', step: 'call',       d: '#1004 (+45 days) → call task for Maya' },
        { t: '09:00:06', step: 'firm_ok',    d: 'Maya gets one link: today\'s firm letters' },
        { t: '09:04:40', step: 'firm_send',  d: 'approved → firm letter sent, accounts copied' }
      ]
    }
  },

  {
    id: 'quote', workflow: 'quote-followup', industry: 'Contractors / trades', goal: 'leads', name: 'The Quote Follow-Up Machine',
    problem: 'You send the quote, then… nothing. The job usually goes to whoever follows up, and following up feels like begging.',
    result: 'Four-touch cadence. Job booked day 7.',
    demo: {
      incoming: { meta: 'System event · Mon 10:14', text: 'Quote Q-218 sent to Marcus · $4,200, bathroom refit' },
      artifact: { meta: 'Email · day 2', text: 'Hi Marcus, following up on your bathroom refit quote ($4,200). We just wrapped a near-identical job on Elm St; photos attached if you\'d like a look. Any questions, or shall I pencil in a start date? — Sam, Riverview Bathrooms' },
      outcome: '<b>Job booked on day 7</b>, with the touches nobody ever gets around to making, and the deposit invoice already in his inbox.',
      log: [
        { t: 'Mon 10:14', step: 'sent',     d: 'quote Q-218 delivered ($4,200 · bathroom refit)' },
        { t: 'Mon 10:14', step: 'cadence',  d: 'touches on days 2, 4, 7 and 14; any reply stops them' },
        { t: 'Wed 10:14', step: 'listen',   d: 'no reply by day 2' },
        { t: 'Wed 10:14', step: 'draft',    d: 'touch 1 drafted: recap + Elm St photos' },
        { t: 'Wed 10:15', step: 'send',     d: 'touch 1 emailed', artifact: true },
        { t: 'Fri 10:14', step: 'send',     d: 'day 4: touch 2 emailed (FAQ + finance options)' },
        { t: 'Mon 14:32', step: 'listen',   d: 'Marcus replied → cadence stopped' },
        { t: 'Mon 14:32', step: 'classify', d: 'go_ahead (0.94)' },
        { t: '14:33',     step: 'won',      d: 'deal marked won in the CRM' },
        { t: '14:33',     step: 'hold',     d: 'first free full day held for the start' },
        { t: '14:33',     step: 'deposit',  d: 'deposit invoice PDF generated and emailed in the same thread' }
      ]
    }
  },

  {
    id: 'admissions', workflow: 'admissions-overflow', industry: 'Education / coaching', goal: 'leads', name: 'Admissions Overflow',
    problem: 'Admissions season means 100+ enquiries a day. Counsellors drown in triage and leads go cold over the weekend.',
    result: 'Matched, assigned and answered in 38 seconds.',
    demo: {
      incoming: { meta: 'Website form · 18:32', text: 'Hi, interested in the Data Analytics course. I work in banking, can only study evenings. — Ahmed' },
      artifact: { meta: 'Email · 38 seconds later', text: 'Hi Ahmed, great fit: our Data Analytics evening track was built for working professionals (92% of modules run after 6pm). If you\'d like a 20-minute chat, Nadia, our finance-careers counsellor, has Tue 18:30, Wed 19:00 or Thu 18:00 open.' },
      outcome: '<b>Answered in 38 seconds at 6:32pm.</b> Met the counsellor Tuesday. Enrolled Friday.',
      log: [
        { t: '18:32:41', step: 'form',    d: 'form enquiry received' },
        { t: '18:32:43', step: 'extract', d: 'interest: data analytics · schedule: evenings · background: banking' },
        { t: '18:33:02', step: 'match',   d: 'Data Analytics (evening) 92% · AI for Finance 70%' },
        { t: '18:33:03', step: 'assign',  d: 'counsellor: Nadia (finance specialty wins over lower load)' },
        { t: '18:33:04', step: 'slots',   d: 'Nadia\'s next three free consult times' },
        { t: '18:33:17', step: 'write',   d: 'reply drafted: why it fits + consult times' },
        { t: '18:33:19', step: 'send',    d: 'emailed to Ahmed', artifact: true },
        { t: '18:33:19', step: 'crm',     d: 'lead created with program and counsellor' },
        { t: '18:33:20', step: 'brief',   d: 'Nadia briefed by email' },
        { t: '18:33:20', step: 'booked',  d: 'waiting up to 48h for a reply' }
      ]
    }
  },

  {
    id: 'report', workflow: 'weekly-report', industry: 'Any business', goal: 'ops', name: 'The Monday Report',
    problem: 'Every Monday, someone burns two hours copy-pasting from five tabs into a report nobody enjoys making.',
    result: 'Report lands before anyone arrives.',
    demo: {
      incoming: { meta: 'Schedule · every Monday 08:00', text: 'Weekly business report · sources: CRM, enrolments, ad spend.' },
      artifact: { meta: 'Email · 08:00, before anyone arrives', text: 'Weekly recap, Oct 5. 38 new leads, 2 enrolments. Google brought leads at $32 each vs $67 from Meta — consider shifting budget. Full breakdown attached (PDF).' },
      outcome: '<b>Two hours reclaimed, every week.</b> The report nobody had time to make, made before coffee.',
      log: [
        { t: '08:00:00', step: 'cron',       d: 'weekly report triggered (0 8 * * MON)' },
        { t: '08:00:01', step: 'leads',      d: 'CRM: 38 new leads, 19 from WhatsApp' },
        { t: '08:00:01', step: 'enrolments', d: '2 enrolments · $4,300 revenue' },
        { t: '08:00:01', step: 'spend',      d: 'ad spend by channel: Meta $1,200 · Google $640' },
        { t: '08:00:02', step: 'aggregate',  d: 'cost per lead $48.42 · conversion 5.3%' },
        { t: '08:00:09', step: 'summarize',  d: 'exec summary + 1 flag: opportunity', artifact: true },
        { t: '08:00:10', step: 'pdf',        d: 'PDF built with tables' },
        { t: '08:00:11', step: 'deliver',    d: 'emailed to owner and sales' }
      ]
    }
  },

  {
    id: 'churn', workflow: 'failed-payment-rescue', industry: 'Memberships / subscriptions', goal: 'cash', name: 'The Silent Churn Rescuer',
    problem: 'Failed card payments quietly end memberships. By the time anyone notices, the member is long gone.',
    result: 'Paused, not cancelled. Member kept.',
    demo: {
      incoming: { meta: 'Stripe · 03:12', text: 'invoice.payment_failed · member Sarah K. · card expired' },
      artifact: { meta: 'WhatsApp · after two retries', text: 'Hi Sarah, this month\'s payment for your Gold membership didn\'t go through (the card may have expired). You can update it here: [secure Stripe link] — or reply PAUSE and we\'ll pause a month instead, streak kept.' },
      outcome: '<b>Membership paused, not lost</b>, without a single awkward call.',
      log: [
        { t: '03:12',       step: 'failed', d: 'Stripe webhook verified: invoice.payment_failed' },
        { t: '03:12',       step: 'member', d: 'member Sarah K. · Gold' },
        { t: '03:12',       step: 'charge', d: 'retry 1: declined (card expired)' },
        { t: '04:12',       step: 'charge', d: 'retry 2 after 1h: declined' },
        { t: 'Day 2 04:12', step: 'charge', d: 'retry 3 after 1 day: declined' },
        { t: 'Day 2 04:12', step: 'notify', d: 'WhatsApp with Stripe\'s secure card-update link', artifact: true },
        { t: 'Day 2 09:41', step: 'listen', d: 'Sarah replied "PAUSE please"' },
        { t: 'Day 2 09:41', step: 'pause',  d: 'Stripe API: subscription paused for a month' }
      ]
    }
  },

  {
    id: 'reviews', workflow: 'review-harvester', industry: 'Local services', goal: 'retain', name: 'The Review Harvester',
    problem: 'Happy customers mean to leave a review and never do. Unhappy ones find Google within the hour.',
    result: 'The 5★ went to Google. The 2★ went to the manager.',
    demo: {
      incoming: { meta: 'Database event · Tue 10:00', text: 'Job #771 (AC service, Fatima R.) marked completed.' },
      artifact: { meta: 'WhatsApp · 24h after the job', text: 'Hi Fatima, hope the AC service is all good! Quick one: how did Joe do, 1 to 5? If anything fell short, tell us here and we\'ll fix it first.' },
      outcome: '<b>The 5★ went to Google with a one-tap link.</b> A 2★ the same week never reached Google: it reached the manager in 40 seconds, with a drafted reply awaiting approval.',
      log: [
        { t: 'Tue 10:00', step: 'done',    d: 'job #771 status → completed (Postgres NOTIFY)' },
        { t: 'Wed 10:00', step: 'wait',    d: '24h passed' },
        { t: 'Wed 10:00', step: 'ask',     d: 'rating request sent', artifact: true },
        { t: 'Wed 10:07', step: 'answer',  d: '"5! Joe was great"' },
        { t: 'Wed 10:07', step: 'read',    d: 'rating 5 · positive (0.97)' },
        { t: 'Wed 10:07', step: 'google',  d: 'one-tap Google review link + 10% code sent' },
        { t: 'Thu 16:40', step: 'alert',   d: 'another job rated 2★ → manager alerted' },
        { t: 'Thu 16:41', step: 'draft',   d: 'recovery reply drafted' },
        { t: 'Thu 16:41', step: 'approve', d: 'waiting on the manager (she can edit before it sends)' }
      ]
    }
  },

  {
    id: 'catering', workflow: 'catering-quote', industry: 'Restaurants / catering', goal: 'leads', name: 'The 12-Minute Catering Quote',
    problem: 'Catering enquiries land in email, DMs and forms. Pricing one eats the manager\'s evening, so half get answered after the client has booked someone else.',
    result: 'Priced, approved and sent in 12 minutes.',
    demo: {
      incoming: { meta: 'Email to events@ · Fri 19:04', text: 'Hi, we need catering for 60 on 14 Dec, office party, around $2.5k. 8 vegetarians. Can you do it? — Hana, Northwind Ltd' },
      artifact: { meta: 'Email · 12 minutes after the enquiry', text: 'Hi Hana, yes, 14 Dec is open! Attached is our Festive Buffet for 60 at $41/head ($2,460 total), with a full vegetarian station for your 8. Shall I hold the date? — Leo, Olive & Ember Catering' },
      outcome: '<b>Quoted in 12 minutes, on a Friday night.</b> Hana signed Monday. The two caterers she\'d also emailed replied Tuesday.',
      log: [
        { t: 'Fri 19:04', step: 'mail',     d: 'enquiry received at events@' },
        { t: '19:04',     step: 'extract',  d: 'date 14 Dec · 60 guests · budget $2,500 · 8 veg · Northwind Ltd' },
        { t: '19:04',     step: 'validate', d: '✓ 30 days\' notice · ✓ within 20–300 guests' },
        { t: '19:05',     step: 'capacity', d: 'kitchen has room on 14 Dec' },
        { t: '19:05',     step: 'pick',     d: 'Festive Buffet: fits $41/head and has a veg station' },
        { t: '19:05',     step: 'quote',    d: 'quote PDF: 60 × $41 = $2,460' },
        { t: '19:14',     step: 'approve',  d: 'manager approved from the link on her phone' },
        { t: '19:16',     step: 'send',     d: 'quote emailed in Hana\'s thread', artifact: true },
        { t: '19:16',     step: 'crm',      d: 'deal created · $2,460 · stage: quoted' }
      ]
    }
  },

  {
    id: 'wismo', workflow: 'order-status', industry: 'E-commerce', goal: 'ops', name: 'Where\'s My Order?',
    problem: 'Most of your support inbox is "where\'s my order?". Every one costs an agent three minutes of tab-switching, often in a language they don\'t speak.',
    result: 'Answered in 6 seconds, in Spanish, no agent.',
    demo: {
      incoming: { meta: 'WhatsApp · 14:02', text: 'hola, dónde está mi pedido? #58213 — Lucía' },
      artifact: { meta: 'WhatsApp · 6 seconds later, in Spanish', text: '¡Hola Lucía! Tu pedido 58213 está en reparto con DHL 🚚 Llega hoy entre las 16:00 y las 18:00. Seguimiento: [enlace]' },
      outcome: '<b>Answered in 6 seconds, in Spanish, with no agent involved.</b> Your team only sees complaints: flagged, prioritised and already summarised.',
      log: [
        { t: '14:02:11', step: 'wa',        d: 'WhatsApp message received' },
        { t: '14:02:12', step: 'classify',  d: 'intent: order_status (0.98) · language: es' },
        { t: '14:02:12', step: 'mood',      d: 'neutral · no escalation' },
        { t: '14:02:13', step: 'number',    d: 'order number: 58213' },
        { t: '14:02:13', step: 'lookup',    d: 'order 58213 · shipped Tue · DHL' },
        { t: '14:02:15', step: 'track',     d: 'carrier API: out for delivery · ETA today 16:00–18:00' },
        { t: '14:02:16', step: 'write',     d: 'answer drafted from order + tracking only' },
        { t: '14:02:16', step: 'translate', d: 'translated to Spanish' },
        { t: '14:02:17', step: 'reply',     d: 'reply sent', artifact: true }
      ]
    }
  },

  {
    id: 'docs', workflow: 'client-documents', industry: 'Accounting / legal', goal: 'ops', name: 'The Document Chaser',
    problem: 'Every new client means chasing a dozen documents across weeks of emails. Your accountants spend Mondays asking for bank statements instead of doing accounts.',
    result: 'Checklist complete on day 9, untouched by staff.',
    demo: {
      incoming: { meta: 'System event · Day 1 09:00', text: 'New client onboarded: Orchard Bakery Ltd · limited company' },
      artifact: { meta: 'Email · day 4 reminder', text: 'Hi Tom, thanks for what you\'ve sent so far — 8 of 12 done. Still needed: • Bank statements Oct–Mar • Your Q4 VAT return • Payroll summary • Van lease agreement. Same link as before: [upload]' },
      outcome: '<b>All 12 documents in by day 9</b>, each identified, checked, named and filed. Priya\'s first touch was a ready-to-start task.',
      log: [
        { t: 'Day 1 09:00', step: 'onboard',   d: 'Orchard Bakery Ltd · type: limited company' },
        { t: '09:00',       step: 'checklist', d: '12 documents required for this client type' },
        { t: '09:00',       step: 'welcome',   d: 'welcome email with a signed upload link' },
        { t: 'Day 2 21:14', step: 'upload',    d: '"scan_0012.pdf" uploaded from Tom\'s phone' },
        { t: '21:14',       step: 'identify',  d: 'Claude read the PDF → bank statements, Apr–Sep' },
        { t: '21:14',       step: 'check',     d: '✓ recognised · ✓ legible' },
        { t: '21:15',       step: 'file',      d: 'filed as bank_statements_2024-04-01_2024-09-30.pdf' },
        { t: '21:15',       step: 'tick',      d: 'checklist: 1 more ticked off' },
        { t: 'Day 4 09:00', step: 'remind',    d: 'reminder lists only what\'s still missing', artifact: true },
        { t: 'Day 9 11:20', step: 'handoff',   d: '12/12 ✓ task for Priya: start the accounts' }
      ]
    }
  },

  {
    id: 'screener', workflow: 'candidate-screening', industry: 'Recruitment / HR', goal: 'ops', name: 'The Candidate Screener',
    problem: 'Three hundred applications for one role. The best candidate applied on day one and accepted another offer before anyone opened the inbox.',
    result: 'Top candidate invited the same morning.',
    demo: {
      incoming: { meta: 'Email to jobs@ · Mon 08:12', text: 'Application: Operations Manager · Dana K. · CV attached' },
      artifact: { meta: 'Email · approved and sent 08:20', text: 'Hi Dana, thanks for applying for Operations Manager — your background is a strong match. Could you do a 30-minute call with Maya, our Head of Operations? Reply with the time that suits you: Tue 10:00 · Wed 11:00 · Thu 15:00' },
      outcome: '<b>Invited within minutes, interviewed Wednesday.</b> Review mode: the recruiter approved each outgoing step with one tap until the workflow earned autonomy.',
      log: [
        { t: 'Mon 08:12', step: 'mail',   d: 'application with CV.pdf attached' },
        { t: '08:12',     step: 'cv',     d: 'Claude read the CV: 7 yrs ops · WMS rollout · Dubai · 30-day notice' },
        { t: '08:12',     step: 'dedupe', d: 'new candidate' },
        { t: '08:13',     step: 'score',  d: '0.86 against the Ops Manager scorecard' },
        { t: '08:13',     step: 'route',  d: '≥ 0.8 → shortlist' },
        { t: '08:19',     step: 'ats',    d: 'review: recruiter approved → added to ATS' },
        { t: '08:19',     step: 'slots',  d: 'Maya\'s next three free half-hours' },
        { t: '08:20',     step: 'invite', d: 'review: approved → invite sent', artifact: true },
        { t: 'Tue 09:02', step: 'pick',   d: 'Dana replied: "Wednesday works"' },
        { t: '09:02',     step: 'choice', d: 'understood as Wed 11:00' },
        { t: '09:10',     step: 'book',   d: 'review: approved → interview on Maya\'s calendar' }
      ]
    }
  },

  {
    id: 'renewals', workflow: 'renewal-radar', industry: 'Insurance brokers', goal: 'retain', name: 'The Renewal Radar',
    problem: 'Policies roll over straight into the insurer\'s price rise. A client who hears nothing at renewal time is a client quietly shopping around.',
    result: 'Every renewal contacted 45 days out, with a better price.',
    demo: {
      incoming: { meta: 'Schedule · daily 07:00', text: 'Renewal scan · policies renewing in 45 days.' },
      artifact: { meta: 'Email · 45 days before renewal', text: 'Hi Aisha, your insurer\'s renewal price is up 14% ($2,540). Harbor offers the same cover for $2,228, saving $312. The one-page comparison is attached. Just reply to switch or stick. — Sam, Harbour Brokers' },
      outcome: '<b>Renewal kept and upgraded to a conversation.</b> The broker spent 3 minutes approving packs, not 3 hours building comparisons.',
      log: [
        { t: '07:00',       step: 'daily',   d: 'daily renewal scan' },
        { t: '07:00',       step: 'due',     d: '6 policies renew in 45 days' },
        { t: '07:01',       step: 'requote', d: 'quote engine: 3 requotes per policy' },
        { t: '07:03',       step: 'compare', d: 'plain-English comparison written' },
        { t: '07:04',       step: 'pack',    d: 'one-page renewal pack PDF' },
        { t: '09:32',       step: 'send',    d: 'review: broker approved → pack sent to Aisha', artifact: true },
        { t: '09:33',       step: 'silent',  d: '2 clients silent for a week → call tasks' },
        { t: 'Day 3 14:10', step: 'reply',   d: 'Aisha replied "switch us please"' },
        { t: '14:10',       step: 'intent',  d: 'switch → task: bind the new policy' }
      ]
    }
  },

  {
    id: 'service', workflow: 'service-reminder', industry: 'Automotive service', goal: 'retain', name: 'The Service Reminder',
    problem: 'Your customers\' cars are due for a service. They just don\'t know it, so they go to whichever garage they drive past first.',
    result: 'Reminder to booked bay in 25 minutes.',
    demo: {
      incoming: { meta: 'Schedule · daily 10:00', text: 'Due-service scan · all customer vehicles.' },
      artifact: { meta: 'WhatsApp · 10:01', text: 'Hi Khalid, by our estimate your RAV4 is just about at 30,000 km, so its major service is due 🔧 Last time was 14 months ago with Joe.  [Book a service]  [Remind me later]' },
      outcome: '<b>Reminder to booked bay in 25 minutes.</b> A service that would have gone to the garage down the road.',
      log: [
        { t: '10:00', step: 'daily',   d: 'daily due-service scan' },
        { t: '10:00', step: 'due',     d: 'SQL: 23 vehicles due by date or estimated km' },
        { t: '10:00', step: 'fresh',   d: 'Khalid\'s RAV4: never reminded for this service' },
        { t: '10:01', step: 'write',   d: 'reminder personalised: 30k service, advisor Joe' },
        { t: '10:01', step: 'send',    d: 'WhatsApp with Book / Later buttons', artifact: true },
        { t: '10:24', step: 'reply',   d: 'Khalid tapped "Book a service"' },
        { t: '10:24', step: 'slots',   d: 'workshop: three free 2-hour bays' },
        { t: '10:24', step: 'offer',   d: 'slots sent as buttons' },
        { t: '10:26', step: 'picked',  d: 'Khalid tapped "Sat 10 Oct, 09:00"' },
        { t: '10:26', step: 'book',    d: 'bay booked, courtesy car noted' }
      ]
    }
  },

  {
    id: 'concierge', workflow: 'pre-arrival-upsell', industry: 'Hotels / hospitality', goal: 'retain', name: 'The Pre-Arrival Concierge',
    problem: 'Guests arrive knowing nothing about your airport transfer, spa or late checkout, so they never buy them. The front desk is too busy to ask.',
    result: 'Add-ons sold before check-in, in the guest\'s language.',
    demo: {
      incoming: { meta: 'New reservation · Mar 2', text: 'Jonas W. · 2 adults · 3 nights · arriving Mar 18 · lands 22:40 · note: "anniversary"' },
      artifact: { meta: 'WhatsApp · 3 days before arrival, in German', text: 'Hallo Jonas! Wir freuen uns auf Sie am 18. März 🌴 Ihr Flug landet um 22:40. Sollen wir Sie abholen? Transfer: $45. Und zum Jahrestag: Late Check-out bis 14 Uhr für $30. Einfach mit JA antworten.' },
      outcome: '<b>$75 of add-ons sold before check-in.</b> And the front desk knew it was their anniversary before they walked in.',
      log: [
        { t: 'Mar 2 11:40',  step: 'booking',   d: 'reservation inserted (Postgres NOTIFY)' },
        { t: 'Mar 15 09:00', step: 'wait',      d: '3 days before arrival' },
        { t: '09:00',        step: 'still_on',  d: 'reservation still confirmed' },
        { t: '09:00',        step: 'pick',      d: 'airport transfer (late flight) + late checkout (anniversary)' },
        { t: '09:00',        step: 'write',     d: 'message drafted' },
        { t: '09:00',        step: 'translate', d: 'guest language: German' },
        { t: '09:01',        step: 'send',      d: 'WhatsApp sent', artifact: true },
        { t: '11:17',        step: 'accepted',  d: '"JA, beides bitte!" → both accepted' },
        { t: '11:17',        step: 'folio',     d: 'PMS API: $75 added to the folio' },
        { t: '11:17',        step: 'desk',      d: 'front desk briefed on Slack: late arrival, anniversary' }
      ]
    }
  },

  {
    id: 'orders', workflow: 'whatsapp-order-intake', industry: 'Wholesale / distribution', goal: 'ops', name: 'Orders by WhatsApp',
    problem: 'Trade customers order by WhatsApp photo, voice note and "same as last week pls". Someone re-types every one into the ERP, and some come out wrong.',
    result: 'Handwritten photo to confirmed ERP order.',
    demo: {
      incoming: { meta: 'WhatsApp · 06:48', text: '[photo] Handwritten order list · from Al Noor Grocers' },
      artifact: { meta: 'WhatsApp · 60 seconds after the photo', text: 'Morning Rashid 👋 Got your list: 3 items, $284.60. We have 8 of the 10 basmati 5kg, so I\'ve sent 8. Reading "tom paste x?" as tomato paste 400g × 24. Tap Confirm and it ships today.  [Confirm]  [Change something]' },
      outcome: '<b>Photo to confirmed ERP order in 14 minutes</b>, 13 of them waiting on the customer\'s breakfast. Nobody re-typed anything.',
      log: [
        { t: '06:48', step: 'wa',       d: 'photo received and downloaded from WhatsApp' },
        { t: '06:48', step: 'customer', d: 'trade customer: Al Noor Grocers' },
        { t: '06:48', step: 'read',     d: 'Claude read the photo: 3 lines, 1 unclear ("tom paste x?")' },
        { t: '06:48', step: 'priced',   d: 'matched to SKUs and prices · $284.60' },
        { t: '06:49', step: 'check',    d: 'credit ✓ · stock: basmati 5kg short (8 of 10)' },
        { t: '06:49', step: 'summary',  d: 'confirmation written with the fix' },
        { t: '06:49', step: 'confirm',  d: 'sent as a reply to the photo, with buttons', artifact: true },
        { t: '07:02', step: 'answer',   d: 'Rashid tapped Confirm' },
        { t: '07:02', step: 'erp',      d: 'ERP API: sales order SO-8812 created' },
        { t: '07:02', step: 'invoice',  d: 'invoice PDF generated and sent on WhatsApp' }
      ]
    }
  }
];
