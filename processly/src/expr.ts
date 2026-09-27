import jsonata from 'jsonata';
import { uploadLink } from './links.js';

/**
 * Expressions are JSONata (https://jsonata.org), evaluated against the run
 * context: { trigger, trigger_id, steps, item, index, run, business }.
 *
 * - Control fields (`if`, `when`, `on`, `over`, `while`, `stop_when`, rule
 *   checks) are bare expressions:          steps.qualify.score > 0.7
 * - Every other parameter is a template:   "Hi {{ trigger.name }}"
 *   A value that is exactly "{{ expr }}" keeps the expression's type
 *   (number, array, object); mixed text is string-interpolated.
 */

const DURATION = /^\s*(?:(\d+(?:\.\d+)?)\s*d)?\s*(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?!s))?\s*(?:(\d+(?:\.\d+)?)\s*s)?\s*$/i;

/** Parses "3d", "24h", "1h30m", "90s" into milliseconds. */
export function parseDuration(input: string | number): number {
  if (typeof input === 'number') return input;
  if (/^\s*-/.test(input)) return -parseDuration(input.replace(/^\s*-/, ''));
  const m = DURATION.exec(input);
  if (!m || m.slice(1).every(x => x === undefined)) throw new ExprError(`invalid duration "${input}" (use e.g. 30m, 24h, 3d, 1h30m)`);
  const [d, h, min, s] = m.slice(1).map(x => (x ? Number(x) : 0));
  return Math.round(((d * 24 + h) * 60 + min) * 60_000 + s * 1000);
}

export class ExprError extends Error {}

const cache = new Map<string, jsonata.Expression>();

let timeZone = 'UTC';
/** Business timezone used by $formatTime. */
export function configureTime(tz: string) { timeZone = tz; }

/** "Thu 8 Oct, 16:00" in the business timezone. style: datetime | date | time */
export function formatTime(ts: string | number, style = 'datetime'): string {
  const opts: Intl.DateTimeFormatOptions = style === 'time' ? { hour: '2-digit', minute: '2-digit' }
    : style === 'date' ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', ...opts }).format(new Date(toMillis(ts)));
}

function register(e: jsonata.Expression) {
  e.registerFunction('uploadLink', (ref: string, folder?: string) => uploadLink(String(ref), folder), '<(sn)s?:s>');
  e.registerFunction('formatTime', (ts: string | number, style?: string) => formatTime(ts, style), '<(sn)s?:s>');
  e.registerFunction('duration', (d: string) => parseDuration(d), '<s:n>');
  e.registerFunction('addDuration', (ts: string | number, d: string) => new Date(toMillis(ts) + parseDuration(d)).toISOString(), '<(sn)s:s>');
  e.registerFunction('daysSince', (ts: string | number) => Math.floor((Date.now() - toMillis(ts)) / 86_400_000), '<(sn):n>');
  e.registerFunction('daysUntil', (ts: string | number) => Math.ceil((toMillis(ts) - Date.now()) / 86_400_000), '<(sn):n>');
}

export function toMillis(ts: string | number | Date): number {
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  const n = Date.parse(ts);
  if (Number.isNaN(n)) throw new ExprError(`not a date: "${ts}"`);
  return n;
}

export function compile(expr: string): jsonata.Expression {
  let e = cache.get(expr);
  if (!e) {
    try {
      e = jsonata(expr);
    } catch (err) {
      throw new ExprError(`cannot parse expression "${expr}": ${(err as Error).message}`);
    }
    register(e);
    cache.set(expr, e);
  }
  return e;
}

export async function evaluate(expr: string, ctx: object): Promise<unknown> {
  try {
    const v = await compile(expr).evaluate(ctx);
    return normalize(v);
  } catch (err) {
    if (err instanceof ExprError) throw err;
    throw new ExprError(`error evaluating "${expr}": ${(err as { message?: string }).message ?? err}`);
  }
}

export async function truthy(expr: string, ctx: object): Promise<boolean> {
  const v = await evaluate(expr, ctx);
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

// JSONata returns arrays tagged with a `sequence` flag and can return undefined;
// normalise to plain JSON so results persist and compare cleanly.
function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  return JSON.parse(JSON.stringify(v));
}

const WHOLE = /^\s*\{\{((?:(?!\}\}|\{\{)[\s\S])+)\}\}\s*$/;
const PART = /\{\{([\s\S]+?)\}\}/g;

/** Resolves {{ }} templates anywhere inside a params value. */
export async function resolve(value: unknown, ctx: object): Promise<unknown> {
  if (typeof value === 'string') {
    const whole = WHOLE.exec(value);
    if (whole) return evaluate(whole[1], ctx);
    if (!value.includes('{{')) return value;
    const parts: string[] = [];
    let last = 0;
    for (const m of value.matchAll(PART)) {
      parts.push(value.slice(last, m.index));
      const v = await evaluate(m[1], ctx);
      parts.push(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
      last = m.index! + m[0].length;
    }
    parts.push(value.slice(last));
    return parts.join('');
  }
  if (Array.isArray(value)) return Promise.all(value.map(v => resolve(v, ctx)));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await resolve(v, ctx);
    return out;
  }
  return value;
}

/** Every expression inside a template value, for load-time syntax checks. */
export function templateExpressions(value: unknown): string[] {
  if (typeof value === 'string') return [...value.matchAll(PART)].map(m => m[1]);
  if (Array.isArray(value)) return value.flatMap(templateExpressions);
  if (value && typeof value === 'object') return Object.values(value).flatMap(templateExpressions);
  return [];
}
