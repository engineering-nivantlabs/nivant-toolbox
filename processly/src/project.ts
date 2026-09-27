import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { loadWorkflowFile, Workflow, WorkflowError } from './workflow.js';

/**
 * A client project is a directory:
 *   business.yaml     who the business is and how it sounds (used by AI steps)
 *   team.yaml         people workflows can notify, assign or ask for approval
 *   connections.yaml  HTTP systems integration.call / data.enrich can reach
 *   workflows/*.yaml  the workflows to run
 *   rubrics/*.md      scoring rubrics for ai.qualify
 *   documents/*.md    templates for doc.generate
 */

const Business = z.object({
  name: z.string(),
  description: z.string().default(''),
  voice: z.string().default('Warm, clear and brief. No jargon.'),
  signature: z.string().default(''),
  timezone: z.string().optional(),
  facts: z.array(z.string()).default([]),
});

const Member = z.object({
  name: z.string(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  slack: z.boolean().default(false),
  roles: z.array(z.string()).default([]),
});

const Connection = z.object({
  base_url: z.string(),
  headers: z.record(z.string(), z.string()).default({}),
  body_format: z.enum(['json', 'form']).default('json'),
  timeout_ms: z.number().int().positive().default(15000),
});

export type Business = z.infer<typeof Business>;
export type Member = z.infer<typeof Member>;
export type Connection = z.infer<typeof Connection> & { missing?: string[] };

export interface Project {
  dir: string;
  business: Business;
  team: Record<string, Member>;
  connections: Record<string, Connection>;
  workflows: Map<string, Workflow>;
}

function readYaml(file: string): unknown {
  return fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) ?? {} : {};
}

/** Replaces ${ENV_VAR} in connection settings so secrets stay out of the repo; reports unset ones. */
function substituteEnv(value: string, env: NodeJS.ProcessEnv, missing: string[]): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    const v = env[name];
    if (v === undefined || v === '') { missing.push(name); return ''; }
    return v;
  });
}

export function loadProject(dir: string, env: NodeJS.ProcessEnv = process.env): Project {
  const errors: string[] = [];
  const parse = <T>(schema: z.ZodType<T>, value: unknown, where: string): T | undefined => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    errors.push(...r.error.issues.map(i => `${where}.${i.path.join('.')}: ${i.message}`));
  };

  const business = parse(Business, readYaml(path.join(dir, 'business.yaml')), 'business.yaml');
  const team = parse(z.record(z.string(), Member), readYaml(path.join(dir, 'team.yaml')), 'team.yaml') ?? {};

  const rawConnections = parse(z.record(z.string(), Connection), readYaml(path.join(dir, 'connections.yaml')), 'connections.yaml') ?? {};
  const connections: Record<string, Connection> = {};
  for (const [name, c] of Object.entries(rawConnections)) {
    const missing: string[] = [];
    const base_url = substituteEnv(c.base_url, env, missing);
    const headers = Object.fromEntries(Object.entries(c.headers).map(([k, v]) => [k, substituteEnv(v, env, missing)]));
    connections[name] = { ...c, base_url: missing.length ? c.base_url : base_url, headers, missing };
  }

  const workflows = new Map<string, Workflow>();
  const wfDir = path.join(dir, 'workflows');
  const files = fs.existsSync(wfDir) ? fs.readdirSync(wfDir).filter(f => /\.ya?ml$/.test(f)).sort() : [];
  for (const f of files) {
    try {
      const wf = loadWorkflowFile(path.join(wfDir, f), dir);
      if (workflows.has(wf.workflow)) errors.push(`workflows/${f}: workflow "${wf.workflow}" is defined twice`);
      workflows.set(wf.workflow, wf);
    } catch (err) {
      if (err instanceof WorkflowError) errors.push(`workflows/${f}:\n${err.problems.map(p => '    ' + p).join('\n')}`);
      else throw err;
    }
  }

  if (errors.length || !business) throw new Error(`Project ${dir} has problems:\n${errors.map(e => '  ' + e).join('\n')}`);
  return { dir, business, team, connections, workflows };
}

export function readProjectFile(project: Project, sub: 'rubrics' | 'documents', name: string): string {
  const file = path.resolve(project.dir, sub, name);
  if (!file.startsWith(path.resolve(project.dir, sub) + path.sep)) throw new Error(`${sub}/${name} is outside the project`);
  if (!fs.existsSync(file)) throw new Error(`${sub}/${name} not found`);
  return fs.readFileSync(file, 'utf8');
}
