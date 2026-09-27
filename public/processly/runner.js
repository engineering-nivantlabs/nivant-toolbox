/* ============ TEMPLATE LIBRARY + DEMO RUNNER ============
 * Renders everything from primitives.js + workflows.js (both exported from the
 * engine) and templates.js (presentation + scripted demo): cards, goal filter,
 * progress chips, workflow map, YAML and the primitives panel.
 */
(function () {
  const P = window.PROCESSLY_PRIMITIVES, W = window.PROCESSLY_WORKFLOWS, GOALS = window.PROCESSLY_GOALS;
  if (!P || !W || !GOALS || !window.PROCESSLY_TEMPLATES) return;
  // Each template's `workflow` names an engine workflow; resolve it once.
  const T = window.PROCESSLY_TEMPLATES.filter(t => W[t.workflow]).map(t => ({ ...t, workflow: W[t.workflow] }));

  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP_MS = RM ? 0 : 750;
  const RESERVED = new Set(['id', 'label', 'use', 'note', 'if', 'on_error', 'branches']);
  const PRIM = Object.fromEntries(P.primitives.map(p => [p.id, p]));
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const byId = id => T.find(t => t.id === id);

  /* ---------- workflow helpers ---------- */
  // Visit every trigger and step; `top` is the chip index (0 = trigger), `path` the ids of enclosing steps.
  function walk(wf, fn) {
    wf.triggers.forEach(tr => fn(tr, 0, []));
    const rec = (steps, top, path) => steps.forEach((s, i) => {
      const ti = top == null ? i + 1 : top;
      fn(s, ti, path);
      (s.branches || []).forEach(b => rec(b.steps, ti, s.id ? path.concat(s.id) : path));
    });
    rec(wf.steps, null, []);
  }
  function usedPrims(t) { const u = new Set(); walk(t.workflow, n => u.add(n.use)); return u; }

  /* ---------- YAML: the engine's own config, re-serialised for display ---------- */
  const M = (...entries) => ({ __m: entries.filter(e => e[1] !== undefined) });
  const asM = v => (v && v.__m ? v : { __m: Object.entries(v) });
  function stepM(s) {
    const e = [];
    if (s.id) e.push(['id', s.id]);
    if (s.label) e.push(['label', s.label]);
    e.push(['use', s.use, s.note]);
    if (s.if) e.push(['if', s.if]);
    if (s.on_error) e.push(['on_error', s.on_error]);
    Object.entries(s).forEach(([k, v]) => { if (!RESERVED.has(k)) e.push([k, v]); });
    if (s.branches) e.push(['branches', s.branches.map(b => M(['label', b.label], ['when', b.when], ['case', b.case], ['otherwise', b.otherwise], ['steps', b.steps.map(stepM)]))]);
    return { __m: e };
  }
  const scalar = v => {
    if (typeof v !== 'string') return String(v);
    return /^[-?:,[\]{}#&*!|>'"%@`\s]|: | #|\s$|^$|^(true|false|null|yes|no|\d[\d.]*)$/i.test(v) ? JSON.stringify(v) : v;
  };
  function emit(m, ind, dash, out) {
    m.__m.forEach(([k, v, c], i) => {
      const pre = ' '.repeat(dash && i > 0 ? ind + 2 : ind) + (dash && i === 0 ? '- ' : '');
      const child = ind + (dash ? 2 : 0) + 2;
      if (typeof v === 'string' && v.includes('\n')) {
        out.push({ pre, k, v: '|', c });
        v.replace(/\n$/, '').split('\n').forEach(line => out.push({ text: ' '.repeat(child) + line }));
      } else if (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object')) out.push({ pre, k, v: '[' + v.map(scalar).join(', ') + ']', c });
      else if (Array.isArray(v)) { out.push({ pre, k, c }); v.forEach(x => emit(asM(x), child, true, out)); }
      else if (v && typeof v === 'object') { out.push({ pre, k, c }); emit(asM(v), child, false, out); }
      else out.push({ pre, k, v: scalar(v), c });
    });
    return out;
  }
  function yamlHTML(wf) {
    const lines = emit(M(['workflow', wf.workflow], ['version', wf.version], ['mode', wf.mode], ['description', wf.description],
      ['triggers', wf.triggers.map(stepM)], ['steps', wf.steps.map(stepM)]), 0, false, []);
    const html = lines.map(l => {
      if (l.text != null) return esc(l.text);
      const plain = l.pre + l.k + ':' + (l.v != null ? ' ' + l.v : '');
      const val = l.v == null ? '' : ' ' + (l.k === 'use' ? `<span class="yp">${esc(l.v)}</span>` : esc(l.v));
      const cmt = l.c ? ' '.repeat(Math.max(2, 34 - plain.length)) + `<span class="yc"># ${esc(l.c)}</span>` : '';
      return esc(l.pre) + `<span class="yk">${esc(l.k)}</span>:` + val + cmt;
    }).join('\n');
    return { html, count: lines.length };
  }

  /* ---------- workflow map ---------- */
  function nodeHTML(n, small) {
    const p = PRIM[n.use];
    return `<div class="wf-node cat-${p.cat}${small ? ' sm' : ''}"${n.id ? ` data-step="${esc(n.id)}"` : ''} title="${esc(p.label + ': ' + p.desc)}">` +
      `<b>${esc(n.label || p.label)}</b><code>${esc(n.use)}</code></div>`;
  }
  function stepsHTML(steps, small) {
    return steps.map((s, i) => (i ? '<div class="wf-arrow"></div>' : '') + nodeHTML(s, small) + (s.branches
      ? '<div class="wf-arrow"></div><div class="wf-branches">' + s.branches.map(b =>
          `<div class="wf-branch"><span class="wf-when" title="${esc(b.when ?? '')}">${esc(b.label ?? b.when ?? (b.otherwise ? 'otherwise' : String(b.case)))}</span>${stepsHTML(b.steps, true)}</div>`).join('') + '</div>'
      : '')).join('');
  }
  const mapHTML = wf => `<div class="wf"><div class="wf-row">${wf.triggers.map(tr => nodeHTML(tr)).join('')}</div>` +
    `<div class="wf-arrow"></div>${stepsHTML(wf.steps)}</div>`;

  /* ---------- static renders ---------- */
  const el = {
    grid: $('tpl-grid'), filters: $('tpl-filters'), industry: $('r-industry'), name: $('r-name'), problem: $('r-problem'),
    chips: $('r-chips'), inMeta: $('r-in-meta'), inText: $('r-in-text'), art: $('r-artifact'), artMeta: $('r-art-meta'),
    artText: $('r-art-text'), outcome: $('r-outcome'), log: $('r-log'), yaml: $('r-yaml'), yamlCount: $('r-yaml-count'),
    map: $('r-map'), run: $('r-run'), replay: $('r-replay'), runner: $('runner'), prims: $('prim-groups'), primCurrent: $('prim-current')
  };

  const usage = {};
  T.forEach(t => usedPrims(t).forEach(u => { usage[u] = (usage[u] || 0) + 1; }));
  document.querySelectorAll('[data-count="templates"]').forEach(n => { n.textContent = T.length; });
  document.querySelectorAll('[data-count="primitives"]').forEach(n => { n.textContent = P.primitives.length; });
  document.querySelectorAll('[data-count="industries"]').forEach(n => { n.textContent = new Set(T.map(t => t.industry)).size; });

  el.grid.innerHTML = T.map(t => `
    <article class="tpl-card" data-tpl="${t.id}" data-goal="${t.goal}">
      <span class="ind-tag">${esc(t.industry)}</span>
      <h3>${esc(t.name)}</h3>
      <p>${esc(t.problem)}</p>
      <p class="tpl-result">${esc(t.result)}</p>
      <div class="tpl-foot">
        <button type="button" class="btn btn-primary btn-sm tpl-run" data-tpl="${t.id}">▶ Run the demo</button>
        <span class="tpl-meta">${usedPrims(t).size} primitives${t.workflow.mode === 'review' ? ' · review mode' : ''}</span>
      </div>
    </article>`).join('');

  el.filters.innerHTML = [{ id: 'all', label: 'All' }].concat(GOALS).map(g => {
    const n = g.id === 'all' ? T.length : T.filter(t => t.goal === g.id).length;
    return `<button type="button" class="tf${g.id === 'all' ? ' on' : ''}" data-goal="${g.id}" aria-pressed="${g.id === 'all'}">${esc(g.label)} <span>${n}</span></button>`;
  }).join('');

  el.prims.innerHTML = P.categories.map(c => `
    <div class="pg">
      <p class="pg-title cat-${c.id}">${esc(c.label)}</p>
      <div class="pg-list">${P.primitives.filter(p => p.cat === c.id).map(p =>
        `<span class="pp cat-${c.id}" data-prim="${p.id}" title="${esc(p.id + ': ' + p.desc)}">${esc(p.label)}<em>×${usage[p.id] || 0}</em></span>`).join('')}</div>
    </div>`).join('');

  /* ---------- load + run ---------- */
  let current = null, runToken = 0, chipOf = {}, pathOf = {};

  function load(id) {
    const t = byId(id); if (!t) return;
    const wf = t.workflow;
    current = id; runToken++;
    chipOf = {}; pathOf = {};
    walk(wf, (n, top, path) => { if (n.id) { chipOf[n.id] = top; pathOf[n.id] = path; } });

    el.industry.textContent = t.industry;
    el.name.textContent = t.name;
    el.problem.textContent = t.problem;
    el.chips.innerHTML = ['Trigger'].concat(wf.steps.map(s => s.label ?? PRIM[s.use].label))
      .map(s => `<span class="rchip">${esc(s)}</span>`).join('<span class="rsep">→</span>');
    el.inMeta.textContent = t.demo.incoming.meta;
    el.inText.textContent = t.demo.incoming.text;
    el.art.hidden = true; el.outcome.hidden = true; el.replay.hidden = true; el.run.hidden = false;
    el.log.innerHTML = '<li class="runlog-empty">Press ▶ Run demo to replay a logged run.</li>';
    el.map.innerHTML = mapHTML(wf);
    const y = yamlHTML(wf);
    el.yaml.innerHTML = y.html;
    el.yamlCount.textContent = y.count;

    const used = usedPrims(t);
    el.primCurrent.textContent = t.name;
    el.prims.querySelectorAll('.pp').forEach(n => n.classList.toggle('used', used.has(n.dataset.prim)));
    el.grid.querySelectorAll('.tpl-card').forEach(c => c.classList.toggle('active', c.dataset.tpl === id));
  }

  async function run() {
    const t = byId(current); if (!t) return;
    const token = ++runToken;
    el.run.classList.remove('pulse');
    el.run.hidden = true; el.replay.hidden = true;
    el.art.hidden = true; el.outcome.hidden = true;
    el.log.innerHTML = '';
    const chips = [...el.chips.querySelectorAll('.rchip')];
    const nodes = [...el.map.querySelectorAll('.wf-node[data-step]')];
    nodes.forEach(n => n.classList.remove('done', 'active'));
    const touched = new Set();
    for (const l of t.demo.log) {
      if (STEP_MS) await sleep(STEP_MS);
      if (token !== runToken) return;
      const n = nodes.find(x => x.dataset.step === l.step);
      const li = document.createElement('li');
      li.innerHTML = `<span class="lt">${esc(l.t)}</span><span class="ls">${esc(n ? n.querySelector('b').textContent : l.step)}</span><span class="ld">${esc(l.d)}</span><span class="lok">✓</span>`;
      el.log.appendChild(li);
      const ci = chipOf[l.step];
      chips.forEach((c, i) => { c.classList.toggle('done', i <= ci); c.classList.toggle('active', i === ci); });
      pathOf[l.step].concat(l.step).forEach(s => touched.add(s));
      nodes.forEach(x => { x.classList.toggle('done', touched.has(x.dataset.step)); x.classList.toggle('active', x.dataset.step === l.step); });
      if (l.artifact) {
        el.artMeta.textContent = t.demo.artifact.meta;
        el.artText.textContent = t.demo.artifact.text;
        el.art.hidden = false;
      }
    }
    if (token !== runToken) return;
    chips.forEach(c => { c.classList.add('done'); c.classList.remove('active'); });
    nodes.forEach(x => x.classList.remove('active'));
    el.outcome.innerHTML = t.demo.outcome; el.outcome.hidden = false;
    el.replay.hidden = false;
  }

  /* ---------- events ---------- */
  el.grid.addEventListener('click', e => {
    const btn = e.target.closest('.tpl-run');
    if (!btn) return;
    load(btn.dataset.tpl);
    el.runner.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
    run();
  });
  el.filters.addEventListener('click', e => {
    const b = e.target.closest('.tf'); if (!b) return;
    el.filters.querySelectorAll('.tf').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    el.grid.querySelectorAll('.tpl-card').forEach(c => { c.hidden = b.dataset.goal !== 'all' && c.dataset.goal !== b.dataset.goal; });
  });
  document.querySelectorAll('.wf-tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.wf-tab').forEach(x => x.setAttribute('aria-selected', x === tab));
    document.querySelectorAll('.wf-pane').forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
  }));
  el.run.addEventListener('click', run);
  el.replay.addEventListener('click', run);

  load(T[0].id);
})();
