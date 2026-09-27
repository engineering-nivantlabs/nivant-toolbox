import { JWT } from 'google-auth-library';
import type { Db } from '../db.js';
import { StepError } from '../engine/types.js';

export interface Slot { start: string; end: string }
export interface Booking { event_id: string; start: string; end: string; calendar: string; provider: string }

export interface SlotQuery { calendar: string; durationMs: number; withinMs: number; count: number; hours: [number, number]; days: number[]; timezone: string; now: Date }

export interface Calendar {
  busy(calendar: string, from: Date, to: Date): Promise<{ start: Date; end: Date }[]>;
  book(b: { calendar: string; title: string; start: Date; end: Date; attendees: string[]; description?: string; hold: boolean; runId: string }): Promise<Booking>;
  release(calendar: string, eventId: string): Promise<{ released: boolean }>;
}

/** Offset of `tz` from UTC at `at`, in minutes (e.g. Dubai → +240). */
function tzOffset(tz: string, at: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at).map(p => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Free slots inside working hours (in the business timezone), skipping busy times. */
export async function findSlots(cal: Calendar, q: SlotQuery): Promise<Slot[]> {
  const from = new Date(Math.ceil(q.now.getTime() / 900_000) * 900_000 + 3_600_000); // ≥1h notice, on a quarter hour
  const to = new Date(from.getTime() + q.withinMs);
  const busy = await cal.busy(q.calendar, from, to);
  const slots: Slot[] = [];
  for (let day = 0; day * 86_400_000 <= q.withinMs + 86_400_000 && slots.length < q.count; day++) {
    const probe = new Date(from.getTime() + day * 86_400_000);
    const off = tzOffset(q.timezone, probe);
    const local = new Date(probe.getTime() + off * 60_000);
    if (!q.days.includes(local.getUTCDay())) continue;
    const dayStartUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - off * 60_000;
    for (let t = dayStartUtc + q.hours[0] * 3_600_000; t + q.durationMs <= dayStartUtc + q.hours[1] * 3_600_000; t += Math.max(q.durationMs, 1_800_000)) {
      if (t < from.getTime() || t + q.durationMs > to.getTime()) continue;
      const s = new Date(t), e = new Date(t + q.durationMs);
      if (busy.some(b => b.start < e && b.end > s)) continue;
      slots.push({ start: s.toISOString(), end: e.toISOString() });
      break; // one slot per day reads better in a message than three on the same morning
    }
  }
  return slots;
}

export class InternalCalendar implements Calendar {
  constructor(private db: Db) {}

  async busy(calendar: string, from: Date, to: Date) {
    const { rows } = await this.db.query(
      `SELECT starts_at, ends_at FROM bookings WHERE calendar = $1 AND NOT cancelled AND starts_at < $3 AND ends_at > $2`, [calendar, from, to]);
    return rows.map(r => ({ start: r.starts_at as Date, end: r.ends_at as Date }));
  }

  async book(b: { calendar: string; title: string; start: Date; end: Date; attendees: string[]; description?: string; hold: boolean; runId: string }) {
    const clash = await this.busy(b.calendar, b.start, b.end);
    if (clash.length) throw new StepError(`slot ${b.start.toISOString()} on ${b.calendar} is already taken`);
    const { rows } = await this.db.query(
      `INSERT INTO bookings (calendar, title, starts_at, ends_at, kind, attendees, description, run_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [b.calendar, b.title, b.start, b.end, b.hold ? 'hold' : 'booking', b.attendees, b.description ?? null, b.runId]);
    return { event_id: rows[0].id, start: b.start.toISOString(), end: b.end.toISOString(), calendar: b.calendar, provider: 'internal' };
  }

  async release(calendar: string, eventId: string) {
    const { rowCount } = await this.db.query(`UPDATE bookings SET cancelled = true WHERE id::text = $1 AND calendar = $2 AND NOT cancelled`, [eventId, calendar]);
    return { released: Boolean(rowCount) };
  }
}

/** Google Calendar via a service account (share each calendar with its email). */
export class GoogleCalendar implements Calendar {
  private jwt: JWT;

  constructor(serviceAccountJson: string, private base: string) {
    const key = JSON.parse(serviceAccountJson);
    this.jwt = new JWT({ email: key.client_email, key: key.private_key, scopes: ['https://www.googleapis.com/auth/calendar'] });
  }

  private async call(method: string, path: string, body?: unknown) {
    let res: Response;
    try {
      const { token } = await this.jwt.getAccessToken();
      res = await fetch(`${this.base}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new StepError(`Google Calendar unreachable: ${(err as Error).message}`, true);
    }
    if (res.status === 204) return {};
    const json = await res.json().catch(() => ({})) as Record<string, any>;
    if (!res.ok) throw new StepError(`Google Calendar ${res.status}: ${json.error?.message ?? res.statusText}`, res.status === 429 || res.status >= 500);
    return json;
  }

  async busy(calendar: string, from: Date, to: Date) {
    const r = await this.call('POST', '/freeBusy', { timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendar }] });
    return (r.calendars?.[calendar]?.busy ?? []).map((b: { start: string; end: string }) => ({ start: new Date(b.start), end: new Date(b.end) }));
  }

  async book(b: { calendar: string; title: string; start: Date; end: Date; attendees: string[]; description?: string; hold: boolean }) {
    const clash = await this.busy(b.calendar, b.start, b.end);
    if (clash.length) throw new StepError(`slot ${b.start.toISOString()} on ${b.calendar} is already taken`);
    // Service accounts can't send invitations without domain-wide delegation,
    // so attendees are listed in the description rather than invited.
    const description = [b.description, b.attendees.length ? `Attendees: ${b.attendees.join(', ')}` : ''].filter(Boolean).join('\n\n');
    const r = await this.call('POST', `/calendars/${encodeURIComponent(b.calendar)}/events`, {
      summary: b.hold ? `HOLD: ${b.title}` : b.title, description,
      start: { dateTime: b.start.toISOString() }, end: { dateTime: b.end.toISOString() },
      transparency: 'opaque',
    });
    return { event_id: String(r.id), start: b.start.toISOString(), end: b.end.toISOString(), calendar: b.calendar, provider: 'google' };
  }

  async release(calendar: string, eventId: string) {
    await this.call('DELETE', `/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(eventId)}`);
    return { released: true };
  }
}
