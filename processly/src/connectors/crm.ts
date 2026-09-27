import type { Db } from '../db.js';
import { StepError } from '../engine/types.js';

export interface Crm {
  create(object: string, stage: string | undefined, data: Record<string, unknown>, runId: string): Promise<{ id: string; provider: string; url?: string }>;
  update(object: string, id: string, stage: string | undefined, data: Record<string, unknown>): Promise<{ id: string; provider: string }>;
}

/** Built-in CRM tables, for businesses that don't have one yet (or for testing). */
export class InternalCrm implements Crm {
  constructor(private db: Db) {}

  async create(object: string, stage: string | undefined, data: Record<string, unknown>, runId: string) {
    const { rows } = await this.db.query(
      `INSERT INTO crm_records (object, stage, data, run_id) VALUES ($1, $2, $3, $4) RETURNING id`, [object, stage ?? null, JSON.stringify(data), runId]);
    return { id: rows[0].id, provider: 'internal' };
  }

  async update(object: string, id: string, stage: string | undefined, data: Record<string, unknown>) {
    const { rowCount } = await this.db.query(
      `UPDATE crm_records SET stage = coalesce($3, stage), data = data || $4, updated_at = now() WHERE id::text = $1 AND object = $2`,
      [id, object, stage ?? null, JSON.stringify(data)]);
    if (!rowCount) throw new StepError(`crm ${object} ${id} not found`);
    return { id, provider: 'internal' };
  }
}

/** HubSpot CRM v3 objects API (private app token). */
export class HubSpotCrm implements Crm {
  constructor(private opts: { token: string; base: string }) {}

  private static objectType(object: string) {
    return ({ lead: 'contacts', contact: 'contacts', candidate: 'contacts', deal: 'deals', company: 'companies', ticket: 'tickets' } as Record<string, string>)[object] ?? object;
  }

  private static props(objectType: string, stage: string | undefined, data: Record<string, unknown>) {
    const properties: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) if (v != null) properties[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (stage) properties[objectType === 'deals' ? 'dealstage' : objectType === 'tickets' ? 'hs_pipeline_stage' : 'hs_lead_status'] = stage;
    return properties;
  }

  private async call(method: string, path: string, body: unknown) {
    let res: Response;
    try {
      res = await fetch(`${this.opts.base}${path}`, {
        method, headers: { Authorization: `Bearer ${this.opts.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new StepError(`HubSpot unreachable: ${(err as Error).message}`, true);
    }
    const json = await res.json().catch(() => ({})) as Record<string, any>;
    if (!res.ok) throw new StepError(`HubSpot ${res.status}: ${json.message ?? res.statusText}`, res.status === 429 || res.status >= 500);
    return json;
  }

  async create(object: string, stage: string | undefined, data: Record<string, unknown>) {
    const type = HubSpotCrm.objectType(object);
    const r = await this.call('POST', `/crm/v3/objects/${type}`, { properties: HubSpotCrm.props(type, stage, data) });
    return { id: String(r.id), provider: 'hubspot' };
  }

  async update(object: string, id: string, stage: string | undefined, data: Record<string, unknown>) {
    const type = HubSpotCrm.objectType(object);
    const r = await this.call('PATCH', `/crm/v3/objects/${type}/${encodeURIComponent(id)}`, { properties: HubSpotCrm.props(type, stage, data) });
    return { id: String(r.id), provider: 'hubspot' };
  }
}
