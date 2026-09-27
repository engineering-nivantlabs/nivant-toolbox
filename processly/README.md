# Processly engine

Runs business workflows written as configuration. There's one engine and 36 reusable primitives; each client's automations are YAML files over those primitives, not custom code.

```
trigger (WhatsApp, email, form, webhook, schedule, upload, DB change)
   → steps (AI, data, business actions, control flow)
   → durable run log in Postgres (every step, input and output)
```

- **Durable.** Runs survive restarts. A workflow can wait 3 days for a reply, or 2 hours for an approval, without holding anything in memory.
- **Earned autonomy.** In `mode: review`, every outgoing action (email, WhatsApp, CRM write, booking, API call) waits for a person. `/api/workflows/:name/stats` counts the review-mode runs that went through untouched, which is your evidence for switching to `mode: auto`.
- **Side effects run at most once.** If the engine crashes in the middle of a send, the step is marked as uncertain. The engine never guesses and re-sends; an operator checks and retries from that step.
- **Secrets stay out of workflows.** Credentials live in env vars and `connections.yaml`; expressions can't read them.

## Quick start

```bash
cp .env.example .env            # fill in what you use; unset integrations just stay off
npm install
npm run migrate
npm run dev                     # HTTP server + worker + schedules on :8080
```

Or run `docker compose up`, which starts Postgres and the engine with `templates/` mounted as the project.

On startup the engine lists every integration a workflow uses that isn't configured yet.

## A client project

A project is a directory (`CONFIG_DIR`). `templates/` is a complete example with all 16 industry templates enabled:

| File | What it is |
|---|---|
| `business.yaml` | Name, voice, signature, timezone, facts. AI steps use this to stay on-brand and on-fact. |
| `team.yaml` | People to notify, assign tasks to, or ask for approval. `to:` takes a key, a role, `team`, or a raw address. |
| `connections.yaml` | HTTP systems (Stripe, ERP, PMS...) with `${ENV}` secrets, for `integration.call` and `data.enrich`. |
| `workflows/*.yaml` | The workflows. |
| `rubrics/*.md` | Scoring rubrics for `ai.qualify`. |
| `documents/*.md` | Markdown templates for `doc.generate` (rendered to PDF). |
| `sample-data.sql` | The example business tables the templates query. In a real deployment, point `DATA_DATABASE_URL` at the client's own database and adjust the SQL. |

To onboard a client: copy `templates/`, delete the workflows they don't need, then edit `business.yaml`, `team.yaml` and the SQL/connection details. Check it with `npx tsx src/cli.ts validate`.

**Routing rule:** an inbound message starts every enabled workflow whose trigger matches it. A reply from someone a run is waiting on (same phone or email, or a reply to a message it sent) resumes that run instead. Keep triggers on the same channel mutually exclusive, with `match:`, `types:`, `inbox:` or `when:`.

## Writing workflows

```yaml
workflow: speed-to-lead-realestate
version: 7
mode: auto                    # or review
triggers:
  - { id: wa, use: trigger.whatsapp, types: [text] }
steps:
  - id: extract
    use: ai.extract
    input: "{{ trigger.text }}"                         # {{ }} = JSONata template
    fields: { budget: { type: number }, area: neighbourhood named }
  - id: route
    use: control.branch
    branches:
      - when: steps.extract.budget > 100000              # bare JSONata expression
        steps: [...]
      - otherwise: true
        steps: [...]
```

- **Context:** expressions see `trigger`, `trigger_id`, `steps.<id>` (each step's output), `item` and `index` inside loops, `run`, and `business`.
- **Common keys on any step:** `if:` (skip unless true), `on_error: continue`, `label:` and `note:`.
- **Extra functions:** `$formatTime(ts)` (business timezone), `$addDuration(ts, '3d')`, `$daysUntil(ts)`, `$daysSince(ts)`, `$uploadLink(ref, folder)`.
- **Validation:** unknown primitives, bad expressions, wrong parameter shapes, duplicate ids and missing rubrics or documents are all reported at load time, with their location.

The full catalog is in `src/catalog.ts`, with every primitive's parameter schema.

## HTTP surface

| Route | Purpose |
|---|---|
| `POST /hooks/form/:workflow` | Website forms: JSON or urlencoded, CORS, `_redirect`, `_gotcha` honeypot |
| `POST /hooks/api[/:workflow]` | Your systems. `Authorization: Bearer HOOK_SECRET`, or `X-Processly-Signature: sha256=<hmac>` |
| `POST /hooks/stripe` | Stripe events, verified with `STRIPE_WEBHOOK_SECRET` |
| `GET/POST /hooks/whatsapp` | Meta Cloud API webhook: verify handshake and signed deliveries; media is downloaded |
| `GET/POST /upload/:token` | Customer upload page from `$uploadLink()` (signed, one per client ref) |
| `GET/POST /approvals/:id?t=` | Phone-friendly approve/reject page (the link is sent to the approver) |
| `/api/*` (Bearer `ADMIN_TOKEN`) | Workflows and stats, runs, run detail, cancel, retry-from-failure, approvals (with edits), tasks, event injection |

Email arrives by polling IMAP (`IMAP_*`). Database events use `processly_notify()`: attach it to any table with `CREATE TRIGGER … EXECUTE FUNCTION processly_notify()`.

## Running in production

- `processly start` runs everything in one process. For more throughput, run one `serve` process and N `worker` processes against the same Postgres; claiming uses `SKIP LOCKED`.
- Schedules may fire from several processes; `schedule_fires` makes each tick run exactly once.
- Put the engine behind HTTPS and set `PUBLIC_URL`; approval and upload links use it.

## Tests

```bash
TEST_PG_URL=postgresql://postgres@localhost:5432/postgres npm test
```

Each test file creates its own database. The suite has 27 tests:
- 20 exercise all 16 templates end to end.
- 7 cover engine mechanics: crash-safety, retries, timeouts, scheduler dedupe, validation and the admin API.

What is and isn't real in the tests:
- **Real:** Postgres, an SMTP server, and the full HTTP surface.
- **Local stand-ins:** the Anthropic Messages API, WhatsApp Graph API, Slack and connected systems. Engine code paths are unchanged; only base URLs point locally.
- **Not exercised against the live services:** Claude, WhatsApp, HubSpot, Google Calendar, IMAP. Try each with real credentials before a client goes live.
