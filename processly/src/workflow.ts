import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { PRIMITIVE_BY_ID, RESERVED_STEP_KEYS, RESERVED_TRIGGER_KEYS } from './catalog.js';
import { compile, templateExpressions } from './expr.js';

export interface Branch { label?: string; when?: string; case?: unknown; otherwise?: boolean; steps: Step[] }
export interface Step { id?: string; label?: string; use: string; note?: string; if?: string; on_error?: 'fail' | 'continue'; branches?: Branch[]; [param: string]: unknown }
export interface Trigger { id: string; label?: string; use: string; when?: string; [param: string]: unknown }
export interface Workflow { workflow: string; version: number; mode: 'auto' | 'review'; description?: string; triggers: Trigger[]; steps: Step[] }

const Id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lower_snake_case');

const StepSchema: z.ZodType<Step> = z.lazy(() =>
  z.object({
    id: Id.optional(), label: z.string().optional(), use: z.string(), note: z.string().optional(),
    if: z.string().optional(), on_error: z.enum(['fail', 'continue']).optional(),
    branches: z.array(z.object({
      label: z.string().optional(), when: z.string().optional(), case: z.unknown().optional(), otherwise: z.boolean().optional(),
      steps: z.array(StepSchema).min(1),
    })).min(1).optional(),
  }).passthrough() as z.ZodType<Step>);

const WorkflowSchema = z.object({
  workflow: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'workflow names are kebab-case'),
  version: z.number().int().positive(),
  mode: z.enum(['auto', 'review']),
  description: z.string().optional(),
  triggers: z.array(z.object({ id: Id, label: z.string().optional(), use: z.string(), when: z.string().optional() }).passthrough()).min(1),
  steps: z.array(StepSchema).min(1),
});

export class WorkflowError extends Error {
  constructor(public file: string, public problems: string[]) {
    super(`${file}:\n${problems.map(p => '  - ' + p).join('\n')}`);
  }
}

export const stepParams = (s: Step | Trigger, reserved = RESERVED_STEP_KEYS) =>
  Object.fromEntries(Object.entries(s).filter(([k]) => !reserved.has(k)));

/** Validates a parsed workflow against the catalog; returns a list of problems. */
export function checkWorkflow(raw: unknown, configDir?: string): { workflow?: Workflow; problems: string[] } {
  const parsed = WorkflowSchema.safeParse(raw);
  if (!parsed.success) return { problems: parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  const wf = parsed.data as Workflow;
  const problems: string[] = [];
  const ids = new Set<string>();
  const addId = (id: string | undefined, where: string) => {
    if (!id) return;
    if (ids.has(id)) problems.push(`${where}: duplicate id "${id}"`);
    ids.add(id);
  };
  const expr = (e: unknown, where: string) => {
    if (typeof e !== 'string') return problems.push(`${where}: expected an expression string`);
    try { compile(e); } catch (err) { problems.push(`${where}: ${(err as Error).message}`); }
  };
  const templates = (v: unknown, where: string) => {
    for (const e of templateExpressions(v)) expr(e, where);
  };
  const fileExists = (v: unknown, dir: string, where: string) => {
    if (!configDir || typeof v !== 'string' || v.includes('{{')) return;
    if (!fs.existsSync(path.join(configDir, dir, v))) problems.push(`${where}: ${dir}/${v} not found`);
  };

  wf.triggers.forEach((t, i) => {
    const where = `triggers[${i}] (${t.id})`;
    addId(t.id, where);
    const p = PRIMITIVE_BY_ID.get(t.use);
    if (!p) return problems.push(`${where}: unknown primitive "${t.use}"`);
    if (p.cat !== 'trigger') problems.push(`${where}: ${t.use} is not a trigger`);
    if (t.when) expr(t.when, `${where}.when`);
    const params = stepParams(t, RESERVED_TRIGGER_KEYS);
    const r = p.params.safeParse(params);
    if (!r.success) problems.push(...r.error.issues.map(e => `${where}.${e.path.join('.')}: ${e.message}`));
  });

  const walk = (steps: Step[], trail: string, top: boolean) => steps.forEach((s, i) => {
    const where = `${trail}[${i}]${s.id ? ` (${s.id})` : ''}`;
    if (top && !s.id) problems.push(`${where}: top-level steps need an id`);
    addId(s.id, where);
    const p = PRIMITIVE_BY_ID.get(s.use);
    if (!p) return problems.push(`${where}: unknown primitive "${s.use}"`);
    if (p.cat === 'trigger') problems.push(`${where}: ${s.use} is a trigger, not a step`);
    if (s.if) expr(s.if, `${where}.if`);
    if (p.container && !s.branches) problems.push(`${where}: ${s.use} needs branches`);
    if (!p.container && s.branches) problems.push(`${where}: ${s.use} can't have branches`);

    const params = stepParams(s);
    for (const [k, v] of Object.entries(params)) {
      if (p.control?.includes(k)) {
        if (k === 'rules') (v as { check?: string }[]).forEach((r, j) => expr(r?.check, `${where}.rules[${j}].check`));
        else expr(v, `${where}.${k}`);
      } else templates(v, `${where}.${k}`);
    }
    // Check parameter shape at load time. A value that is (or sits inside) a
    // {{ template }} can't be known yet, so issues there are left to run time.
    const r = p.params.safeParse(params);
    if (!r.success) {
      const isTemplate = (v: unknown) => typeof v === 'string' && v.includes('{{');
      for (const issue of r.error.issues) {
        let v: unknown = params;
        let templated = false;
        for (const k of issue.path) {
          if (isTemplate(v)) { templated = true; break; }
          v = (v as Record<PropertyKey, unknown> | null | undefined)?.[k as PropertyKey];
        }
        if (templateExpressions(v).length || (!issue.path.length && templateExpressions(params).length)) templated = true;
        if (!templated) problems.push(`${where}.${issue.path.join('.') || '(params)'}: ${issue.message}`);
      }
    }
    if (s.use === 'ai.qualify') fileExists(s.rubric, 'rubrics', `${where}.rubric`);
    if (s.use === 'doc.generate') fileExists(s.template, 'documents', `${where}.template`);

    if (s.branches) {
      const single = s.use === 'control.loop' || s.use === 'control.retry';
      if (single && s.branches.length !== 1) problems.push(`${where}: ${s.use} takes exactly one branch (its body)`);
      s.branches.forEach((b, j) => {
        const bw = `${where}.branches[${j}]`;
        if (s.use === 'control.branch') {
          if (b.otherwise ? b.when : !b.when) problems.push(`${bw}: needs either when: <expression> or otherwise: true`);
          if (b.when) expr(b.when, `${bw}.when`);
          if (b.otherwise && j !== s.branches!.length - 1) problems.push(`${bw}: otherwise must be the last branch`);
        }
        if (s.use === 'control.switch') {
          if (b.otherwise ? b.case !== undefined : b.case === undefined) problems.push(`${bw}: needs either case: <value> or otherwise: true`);
          if (b.otherwise && j !== s.branches!.length - 1) problems.push(`${bw}: otherwise must be the last branch`);
        }
        walk(b.steps, `${bw}.steps`, false);
      });
    }
  });
  walk(wf.steps, 'steps', true);
  return { workflow: wf, problems };
}

export function loadWorkflowFile(file: string, configDir?: string): Workflow {
  let raw: unknown;
  try {
    raw = YAML.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new WorkflowError(file, [`invalid YAML: ${(err as Error).message}`]);
  }
  const { workflow, problems } = checkWorkflow(raw, configDir);
  if (problems.length || !workflow) throw new WorkflowError(file, problems);
  return workflow;
}

/** Visits every step in a workflow tree. */
export function eachStep(steps: Step[], fn: (s: Step) => void) {
  for (const s of steps) {
    fn(s);
    s.branches?.forEach(b => eachStep(b.steps, fn));
  }
}
