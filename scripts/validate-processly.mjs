// Checks the landing page's template library against the engine's exported
// catalog and workflows (public/processly/{primitives,workflows}.js, generated
// by `npm run export:site` in processly/). Usage: npm run validate:processly
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../public/processly/', import.meta.url));
const window = {};
vm.createContext(window);
window.window = window;
for (const f of ['primitives.js', 'workflows.js', 'templates.js']) vm.runInContext(readFileSync(dir + f, 'utf8'), window, { filename: f });

const { primitives } = window.PROCESSLY_PRIMITIVES;
const workflows = window.PROCESSLY_WORKFLOWS;
const goals = new Set(window.PROCESSLY_GOALS.map(g => g.id));
const templates = window.PROCESSLY_TEMPLATES;
const prim = new Set(primitives.map(p => p.id));
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const walk = (steps, fn) => steps.forEach(s => { fn(s); (s.branches ?? []).forEach(b => walk(b.steps, fn)); });
const usage = new Map(primitives.map(p => [p.id, 0]));
const seen = new Set();

for (const t of templates) {
  const at = `template ${t.id}`;
  if (seen.has(t.id)) fail(at, 'duplicate id');
  seen.add(t.id);
  for (const k of ['industry', 'name', 'problem', 'result', 'workflow']) if (!t[k]) fail(at, `missing ${k}`);
  if (!goals.has(t.goal)) fail(at, `unknown goal ${t.goal}`);
  const wf = workflows[t.workflow];
  if (!wf) { fail(at, `no engine workflow "${t.workflow}" in workflows.js (re-run export:site?)`); continue; }

  const ids = new Set(wf.triggers.map(tr => tr.id));
  const used = new Set(wf.triggers.map(tr => tr.use));
  walk(wf.steps, s => { if (s.id) ids.add(s.id); used.add(s.use); });
  for (const u of used) if (!prim.has(u)) fail(at, `workflow uses "${u}", which isn't in the catalog`);
  used.forEach(u => usage.set(u, (usage.get(u) ?? 0) + 1));

  const d = t.demo;
  if (!d?.incoming?.text || !d?.artifact?.text || !d?.outcome || !d?.log?.length) { fail(at, 'demo needs incoming, artifact, outcome and log'); continue; }
  d.log.forEach((l, i) => { if (!ids.has(l.step)) fail(at, `log line ${i} points at "${l.step}", which isn't a step in ${t.workflow}`); });
  const artifacts = d.log.filter(l => l.artifact).length;
  if (artifacts !== 1) fail(at, `demo needs exactly one artifact log line (has ${artifacts})`);
}

const unused = [...usage].filter(([, n]) => n === 0).map(([id]) => id);
if (unused.length) fail('catalog', `primitives no template uses: ${unused.join(', ')}`);

if (errors.length) {
  console.error(errors.map(e => '✗ ' + e).join('\n'));
  process.exit(1);
}
const avg = (templates.reduce((n, t) => { const u = new Set(); workflows[t.workflow].triggers.forEach(x => u.add(x.use)); walk(workflows[t.workflow].steps, s => u.add(s.use)); return n + u.size; }, 0) / templates.length).toFixed(1);
console.log(`✓ ${templates.length} templates · ${primitives.length} primitives · ${new Set(templates.map(t => t.industry)).size} industries · avg ${avg} primitives per template`);
