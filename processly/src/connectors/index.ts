import type { Config } from '../config.js';
import { createPool, Db } from '../db.js';
import type { Project } from '../project.js';
import { Calendar, GoogleCalendar, InternalCalendar } from './calendar.js';
import { Claude } from './claude.js';
import { Crm, HubSpotCrm, InternalCrm } from './crm.js';
import { Email } from './email.js';
import { FileStore } from './files.js';
import { Connections } from './http.js';
import { Notify } from './notify.js';
import { WhatsApp } from './whatsapp.js';

export interface Connectors {
  ai: Claude;
  email: Email;
  whatsapp: WhatsApp;
  crm: Crm;
  calendar: Calendar;
  http: Connections;
  notify: Notify;
  files: FileStore;
  /** Where data.query / data.enrich SQL runs: the business's own database (read-only transactions). */
  dataDb: Db;
}

export function createConnectors(config: Config, db: Db, project: Project): Connectors {
  const email = new Email({ smtpUrl: config.SMTP_URL, from: config.EMAIL_FROM });
  const whatsapp = new WhatsApp({ token: config.WHATSAPP_TOKEN, phoneNumberId: config.WHATSAPP_PHONE_NUMBER_ID, appSecret: config.WHATSAPP_APP_SECRET, base: config.WHATSAPP_API_BASE });

  let crm: Crm = new InternalCrm(db);
  if (config.CRM_PROVIDER === 'hubspot') {
    if (!config.HUBSPOT_TOKEN) throw new Error('CRM_PROVIDER=hubspot needs HUBSPOT_TOKEN');
    crm = new HubSpotCrm({ token: config.HUBSPOT_TOKEN, base: config.HUBSPOT_API_BASE });
  }

  let calendar: Calendar = new InternalCalendar(db);
  if (config.CALENDAR_PROVIDER === 'google') {
    if (!config.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('CALENDAR_PROVIDER=google needs GOOGLE_SERVICE_ACCOUNT_JSON');
    calendar = new GoogleCalendar(config.GOOGLE_SERVICE_ACCOUNT_JSON, config.GOOGLE_CALENDAR_API_BASE);
  }

  return {
    ai: new Claude({ apiKey: config.ANTHROPIC_API_KEY, baseURL: config.ANTHROPIC_BASE_URL, model: config.PROCESSLY_MODEL, business: project.business }),
    email, whatsapp, crm, calendar,
    http: new Connections(project.connections),
    notify: new Notify(project.team, email, whatsapp, config.SLACK_WEBHOOK_URL),
    files: new FileStore(db, config.filesDir),
    dataDb: config.DATA_DATABASE_URL ? createPool(config.DATA_DATABASE_URL) : db,
  };
}
