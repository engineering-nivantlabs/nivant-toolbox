import { StepError } from '../engine/types.js';
import type { Member } from '../project.js';
import type { Email } from './email.js';
import type { WhatsApp } from './whatsapp.js';

type Channel = 'auto' | 'slack' | 'email' | 'whatsapp';

/**
 * Sends a short message to people in team.yaml. `to` can be a member key,
 * a role (every member with it), "team" (everyone), or a raw email/phone.
 */
export class Notify {
  constructor(private team: Record<string, Member>, private email: Email, private whatsapp: WhatsApp, private slackWebhook?: string) {}

  resolve(to: string | string[]): { label: string; member?: Member; raw?: string }[] {
    const out: { label: string; member?: Member; raw?: string }[] = [];
    for (const t of ([] as string[]).concat(to)) {
      if (this.team[t]) out.push({ label: t, member: this.team[t] });
      else if (t === 'team') out.push(...Object.entries(this.team).map(([k, m]) => ({ label: k, member: m })));
      else {
        const byRole = Object.entries(this.team).filter(([, m]) => m.roles.includes(t));
        if (byRole.length) out.push(...byRole.map(([k, m]) => ({ label: k, member: m })));
        else if (/@/.test(t) || /^\+?\d{7,}$/.test(t)) out.push({ label: t, raw: t });
        else throw new StepError(`"${t}" is not a team member, role or address (see team.yaml)`);
      }
    }
    return out;
  }

  private async slack(text: string) {
    let res: Response;
    try {
      res = await fetch(this.slackWebhook!, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      throw new StepError(`Slack unreachable: ${(err as Error).message}`, true);
    }
    if (!res.ok) throw new StepError(`Slack webhook ${res.status}`, res.status >= 500);
  }

  async send(to: string | string[], text: string, channel: Channel = 'auto', idempotencyKey = `notify:${Date.now()}`) {
    const sent: { to: string; via: string }[] = [];
    let slackPosted = false;
    for (const r of this.resolve(to)) {
      const m = r.member;
      const pick = (c: Channel) => channel === 'auto' || channel === c;
      if (m?.slack && this.slackWebhook && pick('slack')) {
        if (!slackPosted) await this.slack(text);
        slackPosted = true;
        sent.push({ to: r.label, via: 'slack' });
      } else if ((m?.whatsapp || (r.raw && !r.raw.includes('@'))) && this.whatsapp.enabled && pick('whatsapp')) {
        await this.whatsapp.sendText(m?.whatsapp ?? r.raw!, text);
        sent.push({ to: r.label, via: 'whatsapp' });
      } else if ((m?.email || r.raw?.includes('@')) && this.email.enabled && pick('email')) {
        await this.email.send({ to: [m?.email ?? r.raw!], subject: text.split('\n')[0].slice(0, 120), text, idempotencyKey: `${idempotencyKey}:${r.label}` });
        sent.push({ to: r.label, via: 'email' });
      } else {
        throw new StepError(`no configured channel reaches ${r.label} (check team.yaml and SLACK/WHATSAPP/SMTP settings)`);
      }
    }
    return { sent };
  }
}
