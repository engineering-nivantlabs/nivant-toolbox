import crypto from 'node:crypto';
import { StepError } from '../engine/types.js';

/** WhatsApp Business Cloud API (Meta Graph API). */
export class WhatsApp {
  constructor(private opts: { token?: string; phoneNumberId?: string; appSecret?: string; base: string }) {}

  get enabled() { return Boolean(this.opts.token && this.opts.phoneNumberId); }

  private async graph(path: string, init: RequestInit & { json?: unknown } = {}) {
    if (!this.enabled) throw new StepError('WhatsApp is not configured (set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID)');
    const headers: Record<string, string> = { Authorization: `Bearer ${this.opts.token}` };
    if (init.json !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(`${this.opts.base}/${path}`, { ...init, headers: { ...headers, ...(init.headers as object) }, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, signal: AbortSignal.timeout(20_000) });
    } catch (err) {
      throw new StepError(`WhatsApp API unreachable: ${(err as Error).message}`, true);
    }
    const body = await res.json().catch(() => ({})) as { error?: { message?: string; code?: number } };
    if (!res.ok) {
      throw new StepError(`WhatsApp API ${res.status}: ${body.error?.message ?? res.statusText}`, res.status === 429 || res.status >= 500);
    }
    return body as Record<string, any>;
  }

  private async send(to: string, message: Record<string, unknown>, replyTo?: string) {
    const body = await this.graph(`${this.opts.phoneNumberId}/messages`, {
      method: 'POST',
      json: { messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/[^\d]/g, ''), ...(replyTo && { context: { message_id: replyTo } }), ...message },
    });
    return { message_id: String(body.messages?.[0]?.id ?? ''), to };
  }

  sendText(to: string, text: string, replyTo?: string) {
    return this.send(to, { type: 'text', text: { body: text, preview_url: true } }, replyTo);
  }

  /** Up to three quick-reply buttons (titles max 20 characters). */
  sendButtons(to: string, text: string, buttons: string[], replyTo?: string) {
    return this.send(to, {
      type: 'interactive',
      interactive: { type: 'button', body: { text }, action: { buttons: buttons.map((title, i) => ({ type: 'reply', reply: { id: `b${i}`, title: title.slice(0, 20) } })) } },
    }, replyTo);
  }

  /** Pre-approved template: required to message someone outside the 24h service window. */
  sendTemplate(to: string, name: string, language: string, params: (string | number)[]) {
    return this.send(to, {
      type: 'template',
      template: { name, language: { code: language }, ...(params.length && { components: [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: String(p) })) }] }) },
    });
  }

  async sendDocument(to: string, file: { name: string; mime: string; data: Buffer }, caption?: string) {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', file.mime);
    form.append('file', new Blob([new Uint8Array(file.data)], { type: file.mime }), file.name);
    const media = await this.graph(`${this.opts.phoneNumberId}/media`, { method: 'POST', body: form });
    return this.send(to, { type: 'document', document: { id: media.id, filename: file.name, ...(caption && { caption }) } });
  }

  async downloadMedia(mediaId: string): Promise<{ data: Buffer; mime: string }> {
    const meta = await this.graph(mediaId);
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${this.opts.token}` }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`media download failed: ${res.status}`);
    return { data: Buffer.from(await res.arrayBuffer()), mime: String(meta.mime_type ?? res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0] };
  }

  /** Verifies Meta's X-Hub-Signature-256 over the raw request body. */
  verifySignature(raw: Buffer, header: string | undefined): boolean {
    if (!this.opts.appSecret) return false;
    if (!header?.startsWith('sha256=')) return false;
    const want = Buffer.from('sha256=' + crypto.createHmac('sha256', this.opts.appSecret).update(raw).digest('hex'));
    const got = Buffer.from(header);
    return want.length === got.length && crypto.timingSafeEqual(want, got);
  }
}

export interface InboundWhatsApp {
  message_id: string; from: string; name: string | null; type: string; text: string;
  button: string | null; context_id: string | null; timestamp: string; media_id: string | null; media_mime: string | null; filename: string | null;
}

/** Flattens a Cloud API webhook body into one record per inbound message. */
export function parseWhatsAppWebhook(body: any): InboundWhatsApp[] {
  const out: InboundWhatsApp[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const names = new Map<string, string>((value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));
      for (const m of value.messages ?? []) {
        const media = m.image ?? m.document ?? m.audio ?? m.video ?? m.sticker ?? null;
        const button = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? m.button?.text ?? null;
        out.push({
          message_id: m.id, from: m.from, name: names.get(m.from) ?? null, type: m.type,
          text: m.text?.body ?? button ?? media?.caption ?? '',
          button, context_id: m.context?.id ?? null, timestamp: new Date(Number(m.timestamp) * 1000).toISOString(),
          media_id: media?.id ?? null, media_mime: media?.mime_type ?? null, filename: media?.filename ?? null,
        });
      }
    }
  }
  return out;
}
