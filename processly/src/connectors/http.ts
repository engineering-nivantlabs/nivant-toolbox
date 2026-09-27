import { StepError } from '../engine/types.js';
import type { Connection } from '../project.js';

/** Encodes nested objects the way Stripe-style form APIs expect: a[b][0]=c. */
function formEncode(obj: unknown, prefix = '', out = new URLSearchParams()): URLSearchParams {
  if (obj == null) return out;
  if (typeof obj !== 'object') { out.append(prefix, String(obj)); return out; }
  for (const [k, v] of Object.entries(obj as object)) formEncode(v, prefix ? `${prefix}[${k}]` : k, out);
  return out;
}

/** Calls a system declared in connections.yaml. Credentials never pass through workflow expressions. */
export class Connections {
  constructor(private connections: Record<string, Connection>) {}

  names() { return Object.keys(this.connections); }

  async call(name: string, req: { method: string; path: string; query?: Record<string, unknown>; body?: unknown; idempotencyKey?: string }) {
    const c = this.connections[name];
    if (!c) throw new StepError(`unknown connection "${name}" (declare it in connections.yaml)`);
    if (c.missing?.length) throw new StepError(`connection "${name}" needs environment variable(s) ${[...new Set(c.missing)].join(', ')}`);
    const url = new URL(req.path.replace(/^\//, ''), c.base_url.endsWith('/') ? c.base_url : c.base_url + '/');
    for (const [k, v] of Object.entries(req.query ?? {})) if (v != null) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { Accept: 'application/json', ...c.headers };
    if (req.idempotencyKey) headers['Idempotency-Key'] = req.idempotencyKey;
    let body: string | undefined;
    if (req.body !== undefined && req.method !== 'GET') {
      if (c.body_format === 'form') { body = formEncode(req.body).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
      else { body = JSON.stringify(req.body); headers['Content-Type'] = 'application/json'; }
    }
    let res: Response;
    try {
      res = await fetch(url, { method: req.method, headers, body, signal: AbortSignal.timeout(c.timeout_ms) });
    } catch (err) {
      throw new StepError(`${name} unreachable: ${(err as Error).message}`, true);
    }
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      const detail = typeof parsed === 'object' && parsed ? JSON.stringify(parsed).slice(0, 300) : String(text).slice(0, 300);
      throw new StepError(`${name} ${req.method} ${url.pathname} → ${res.status}: ${detail}`, res.status === 429 || res.status >= 500);
    }
    return { status: res.status, body: parsed };
  }
}
