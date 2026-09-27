import crypto from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import { StepError } from '../engine/types.js';

export interface OutboundEmail {
  to: string[]; cc?: string[]; subject: string; text: string; html?: string; replyTo?: string; inReplyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  idempotencyKey: string;
}

export class Email {
  private transport: Transporter | null;

  constructor(private opts: { smtpUrl?: string; from?: string }) {
    this.transport = opts.smtpUrl ? nodemailer.createTransport(opts.smtpUrl) : null;
  }

  get enabled() { return Boolean(this.transport && this.opts.from); }

  /** Message-IDs are derived from the run step, so replies can be matched back to it. */
  messageId(idempotencyKey: string) {
    const domain = (this.opts.from ?? 'processly.local').replace(/.*@/, '').replace(/[>\s].*/, '') || 'processly.local';
    return `<${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32)}@${domain}>`;
  }

  async send(m: OutboundEmail) {
    if (!this.transport || !this.opts.from) throw new StepError('email is not configured (set SMTP_URL and EMAIL_FROM)');
    const messageId = this.messageId(m.idempotencyKey);
    try {
      const info = await this.transport.sendMail({
        from: this.opts.from, to: m.to, cc: m.cc, subject: m.subject, text: m.text, html: m.html,
        replyTo: m.replyTo, inReplyTo: m.inReplyTo, references: m.inReplyTo, messageId, attachments: m.attachments,
      });
      return { message_id: messageId, accepted: (info.accepted as unknown[]).map(String), rejected: (info.rejected as unknown[]).map(String) };
    } catch (err) {
      const e = err as { responseCode?: number; code?: string; message: string };
      // 4xx SMTP replies and connection problems are temporary; 5xx are permanent.
      const retryable = (e.responseCode ?? 0) < 500 || ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(e.code ?? '');
      throw new StepError(`email failed: ${e.message}`, retryable);
    }
  }
}
