import Anthropic from '@anthropic-ai/sdk';
import type { Business } from '../project.js';
import { StepError } from '../engine/types.js';

type Effort = 'low' | 'medium' | 'high';
type Content = Anthropic.Beta.BetaContentBlockParam;

export interface Attachment { name: string; mime: string; data: Buffer }

/**
 * Every AI primitive is one Claude call returning JSON that matches a schema
 * (structured outputs), so downstream steps can rely on the shape.
 */
export class Claude {
  private _client: Anthropic | null = null;

  constructor(private opts: { apiKey?: string; baseURL?: string; model: string; business: Business }) {}

  // Created on first use so the engine starts (and non-AI workflows run) without credentials.
  // With no explicit key the SDK resolves ANTHROPIC_API_KEY / auth profiles itself.
  private get client(): Anthropic {
    if (!this._client) {
      try {
        this._client = new Anthropic({ apiKey: this.opts.apiKey, baseURL: this.opts.baseURL });
      } catch (err) {
        throw new StepError(`Claude is not configured (set ANTHROPIC_API_KEY): ${(err as Error).message}`);
      }
    }
    return this._client;
  }

  private system(task: string): string {
    const b = this.opts.business;
    return [
      `You are the automation engine for ${b.name}. ${b.description}`.trim(),
      b.facts.length ? `Facts about the business:\n${b.facts.map(f => `- ${f}`).join('\n')}` : '',
      `Voice for anything customer-facing: ${b.voice}`,
      b.signature ? `Sign customer messages as: ${b.signature}` : '',
      `Your task: ${task}`,
      'Base every answer only on the input provided. If information is missing, use null rather than guessing.',
    ].filter(Boolean).join('\n\n');
  }

  static content(text: string, attachments: Attachment[] = []): Content[] {
    const blocks: Content[] = [];
    for (const a of attachments) {
      if (/^image\/(png|jpe?g|gif|webp)$/.test(a.mime)) {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mime.replace('jpg', 'jpeg') as 'image/png', data: a.data.toString('base64') } });
      } else if (a.mime === 'application/pdf') {
        blocks.push({ type: 'document', title: a.name, source: { type: 'base64', media_type: 'application/pdf', data: a.data.toString('base64') } });
      } else if (a.mime.startsWith('text/') || a.mime === 'application/json') {
        blocks.push({ type: 'text', text: `Attachment "${a.name}":\n${a.data.toString('utf8')}` });
      } else {
        blocks.push({ type: 'text', text: `(Attachment "${a.name}" of type ${a.mime} can't be read here.)` });
      }
    }
    blocks.push({ type: 'text', text });
    return blocks;
  }

  async json<T>(o: { task: string; input: Content[]; schema: Record<string, unknown>; effort?: Effort; maxTokens?: number }): Promise<T> {
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await this.client.beta.messages.create({
        model: this.opts.model,
        max_tokens: o.maxTokens ?? 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: this.system(o.task),
        messages: [{ role: 'user', content: o.input }],
        output_config: { effort: o.effort ?? 'medium', format: { type: 'json_schema', schema: o.schema } },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
        throw new StepError(`Claude API unavailable: ${err.message}`, true);
      }
      if (err instanceof Anthropic.AuthenticationError) throw new StepError('Claude API key rejected (check ANTHROPIC_API_KEY)');
      if (err instanceof Anthropic.APIError) throw new StepError(`Claude API error ${err.status}: ${err.message}`, (err.status ?? 0) >= 500);
      // Anything else is client-side (no credentials, bad options): retrying won't fix it.
      throw new StepError(`Claude is not configured: ${(err as Error).message}`);
    }
    if (res.stop_reason === 'refusal') {
      throw new StepError(`Claude declined this input${res.stop_details?.category ? ` (${res.stop_details.category})` : ''}; needs a person`);
    }
    if (res.stop_reason === 'max_tokens') throw new StepError('Claude response was cut off (max_tokens)');
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('');
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new StepError(`Claude returned invalid JSON: ${text.slice(0, 200)}`, true);
    }
  }
}

/** JSON-schema helpers for structured outputs (every object closed, every key required). */
export const S = {
  obj: (props: Record<string, object>): Record<string, unknown> => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false }),
  str: (description?: string) => ({ type: 'string', ...(description && { description }) }),
  nstr: (description?: string) => ({ type: ['string', 'null'], ...(description && { description }) }),
  num: (description?: string) => ({ type: 'number', ...(description && { description }) }),
  nint: (description?: string) => ({ type: ['integer', 'null'], ...(description && { description }) }),
  bool: (description?: string) => ({ type: 'boolean', ...(description && { description }) }),
  enum: (values: string[], description?: string) => ({ type: 'string', enum: values, ...(description && { description }) }),
  arr: (items: object) => ({ type: 'array', items }),
};
