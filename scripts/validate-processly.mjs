// Validates the Processly template library against the primitive catalog.
// Usage: npm run validate:processly
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../public/processly/', import.meta.url));
const window = {};
vm.createContext(window);
window.window = window;
for (const f of ['primitives.js', 'templates.js']) vm.runInContext(readFileSync(dir + f, 'utf8'), window, { filename: f });

const { categories, primitives } = window.PROCESSLY_PRIMITIVES;
const goals = window.PROCESSLY_GOALS;
const templates = window.PROCESSLY_TEMPLATES;
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const catIds = new Set(categories.map(c => c.id));
const prim = new Map();
for (const p of primitives) {
  if (prim.has(p.id)) fail('primitives', `duplicate id ${p.id}`);
  if (!catIds.has(p.cat)) fail('primitives', `${p.id} has unknown category ${p.cat}`);
  if (!p.label || !p.desc) fail('primitives', `${p.id} needs a label and desc`);
  prim.set(p.id, p);
}

const goalIds = new Set(goals.map(g => g.id));
const templateIds = new Set();
const usage = new Map(primitives.map(p => [p.id, 0]));

for (const t of templates) {
  const at = `template ${t.id}`;
  if (templateIds.has(t.id)) fail(at, 'duplicate template id');
  templateIds.add(t.id);
  for (const k of ['industry', 'name', 'problem', 'result']) if (!t[k]) fail(at, `missing ${k}`);
  if (!goalIds.has(t.goal)) fail(at, `unknown goal ${t.goal}`);

  const wf = t.workflow;
  if (!wf || !wf.name || !wf.version || !['auto', 'review'].includes(wf.mode)) fail(at, 'workflow needs name, version and mode auto|review');
  if (!wf?.triggers?.length) fail(at, 'workflow needs at least one trigger');
  if (!wf?.steps?.length) fail(at, 'workflow needs at least one step');

  const ids = new Set(), used = new Set();
  const check = (node, where, isTrigger) => {
    const p = prim.get(node.use);
    if (!p) return fail(at, `${where} uses unknown primitive "${node.use}"`);
    if (isTrigger !== (p.cat === 'trigger')) fail(at, `${where}: ${node.use} ${isTrigger ? 'is not a trigger' : 'is a trigger, not a step'}`);
    used.add(node.use);
    if (node.id) {
      if (ids.has(node.id)) fail(at, `duplicate step id ${node.id}`);
      ids.add(node.id);
    }
    if (node.branches) {
      if (!['control.branch', 'control.switch', 'control.loop', 'control.retry'].includes(node.use)) fail(at, `${where}: ${node.use} can't have branches`);
      if (!node.branches.length) fail(at, `${where}: empty branches`);
      node.branches.forEach((b, i) => {
        if (!b.when) fail(at, `${where} branch ${i} needs a "when"`);
        if (!b.steps?.length) fail(at, `${where} branch ${i} has no steps`);
        (b.steps || []).forEach((s, j) => check(s, `${where}.${i}.${j}`, false));
      });
    } else if (['control.branch', 'control.switch', 'control.loop', 'control.retry'].includes(node.use)) {
      fail(at, `${where}: ${node.use} needs branches`);
    }
  };
  (wf?.triggers || []).forEach((tr, i) => check(tr, `trigger ${i}`, true));
  (wf?.steps || []).forEach((s, i) => {
    if (!s.id || !s.label) fail(at, `top-level step ${i} needs an id and label`);
    check(s, `step ${s.id || i}`, false);
  });
  used.forEach(u => usage.set(u, usage.get(u) + 1));

  const d = t.demo;
  if (!d?.incoming?.text || !d?.artifact?.text || !d?.outcome || !d?.log?.length) { fail(at, 'demo needs incoming, artifact, outcome and log'); continue; }
  d.log.forEach((l, i) => { if (!ids.has(l.step)) fail(at, `log line ${i} points at unknown step "${l.step}"`); });
  const artifacts = d.log.filter(l => l.artifact).length;
  if (artifacts !== 1) fail(at, `demo needs exactly one artifact log line (has ${artifacts})`);
}

const unused = [...usage].filter(([, n]) => n === 0).map(([id]) => id);
if (unused.length) fail('catalog', `primitives no template uses: ${unused.join(', ')}`);

if (errors.length) {
  console.error(errors.map(e => '✗ ' + e).join('\n'));
  process.exit(1);
}
const avg = (templates.reduce((n, t) => n + new Set(JSON.stringify(t.workflow).match(/"use":"[^"]+"/g)).size, 0) / templates.length).toFixed(1);
console.log(`✓ ${templates.length} templates · ${primitives.length} primitives · ${new Set(templates.map(t => t.industry)).size} industries · avg ${avg} primitives per template`);
