#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createServices, start } from './app.js';
import { loadConfig } from './config.js';
import { createPool, migrate } from './db.js';
import { decideApproval } from './engine/approvals.js';
import { startRun } from './engine/events.js';
import { Worker } from './engine/worker.js';
import { loadProject } from './project.js';
import { loadWorkflowFile, WorkflowError } from './workflow.js';

const HELP = `processly <command>

  start                 HTTP server + worker + schedules/inbox/db triggers
  serve                 HTTP server + triggers only (run workers separately)
  worker                worker only
  migrate               apply database migrations
  validate [--templates <dir>]
                        check the project in CONFIG_DIR (and optionally a template library)
  run <workflow> [--trigger <id>] [--payload <file.json> | --json '<json>']
                        start a run and execute it here until it finishes or waits
  approve <approval-id> [--reject] [--note <text>]
`;

async function main() {
  // Pick up ./.env when present (Node >= 20.12); real environment variables win.
  try { process.loadEnvFile(); } catch { /* no .env */ }
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'start': await start(); return;
    case 'serve': await start({ http: true, worker: false, triggers: true }); return;
    case 'worker': await start({ http: false, worker: true, triggers: false }); return;

    case 'migrate': {
      const db = createPool(loadConfig().DATABASE_URL);
      const applied = await migrate(db);
      console.log(applied.length ? `applied: ${applied.join(', ')}` : 'up to date');
      await db.end();
      return;
    }

    case 'validate': {
      const { values } = parseArgs({ args: rest, options: { templates: { type: 'string' } } });
      const dir = path.resolve(process.env.CONFIG_DIR ?? './config');
      const project = loadProject(dir);
      console.log(`✓ ${dir}: ${project.business.name}, ${project.workflows.size} workflow(s), ${Object.keys(project.team).length} team member(s), ${Object.keys(project.connections).length} connection(s)`);
      if (values.templates) {
        const tdir = path.resolve(values.templates);
        let bad = 0;
        for (const f of fs.readdirSync(tdir).filter(f => f.endsWith('.yaml')).sort()) {
          try { const wf = loadWorkflowFile(path.join(tdir, f), dir); console.log(`✓ ${f} (${wf.workflow} v${wf.version}, ${wf.mode})`); }
          catch (err) { bad++; console.error(err instanceof WorkflowError ? `✗ ${err.message}` : err); }
        }
        if (bad) process.exitCode = 1;
      }
      return;
    }

    case 'run': {
      const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { trigger: { type: 'string' }, payload: { type: 'string' }, json: { type: 'string' } } });
      const services = await createServices();
      const wf = services.project.workflows.get(positionals[0] ?? '');
      if (!wf) throw new Error(`unknown workflow "${positionals[0]}" (have: ${[...services.project.workflows.keys()].join(', ')})`);
      const payload = values.payload ? JSON.parse(fs.readFileSync(values.payload, 'utf8')) : values.json ? JSON.parse(values.json) : {};
      const run = await startRun(services.db, wf, values.trigger ?? wf.triggers[0].id, payload);
      console.log(`run ${run.id}`);
      await new Worker(services).drain();
      const { rows } = await services.db.query(`SELECT status, error, stop_reason, wake_at FROM runs WHERE id = $1`, [run.id]);
      console.log(rows[0]);
      await services.db.end();
      return;
    }

    case 'approve': {
      const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { reject: { type: 'boolean' }, note: { type: 'string' } } });
      const db = createPool(loadConfig().DATABASE_URL);
      const a = await decideApproval(db, positionals[0], { decision: values.reject ? 'rejected' : 'approved', by: 'cli', note: values.note });
      console.log(`${values.reject ? 'rejected' : 'approved'}; run ${a.run_id} queued`);
      await db.end();
      return;
    }

    default:
      console.log(HELP);
      if (cmd && cmd !== 'help') process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
