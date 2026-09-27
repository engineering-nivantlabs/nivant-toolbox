import path from 'node:path';
import { z } from 'zod';

// Everything the engine reads from the environment. Connectors that aren't
// configured stay disabled and fail with a clear error if a workflow uses them.
const Env = z.object({
  DATABASE_URL: z.string().min(1),
  DATA_DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().default(8080),
  PUBLIC_URL: z.string().default('http://localhost:8080'),
  CONFIG_DIR: z.string().default('./config'),
  FILES_DIR: z.string().default('./data/files'),
  ADMIN_TOKEN: z.string().min(16, 'ADMIN_TOKEN must be at least 16 characters'),
  HOOK_SECRET: z.string().min(16, 'HOOK_SECRET must be at least 16 characters'),
  TZ: z.string().default('UTC'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(4),
  WORKER_POLL_MS: z.coerce.number().int().min(50).default(1000),
  STEP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),

  // Claude
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  PROCESSLY_MODEL: z.string().default('claude-opus-5'),

  // Email
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),
  IMAP_SECURE: z.string().default('true').transform(v => v !== 'false'),
  IMAP_POLL_MS: z.coerce.number().default(30000),

  // WhatsApp Cloud API
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_API_BASE: z.string().default('https://graph.facebook.com/v21.0'),

  // CRM
  CRM_PROVIDER: z.enum(['internal', 'hubspot']).default('internal'),
  HUBSPOT_TOKEN: z.string().optional(),
  HUBSPOT_API_BASE: z.string().default('https://api.hubapi.com'),

  // Calendar
  CALENDAR_PROVIDER: z.enum(['internal', 'google']).default('internal'),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_CALENDAR_API_BASE: z.string().default('https://www.googleapis.com/calendar/v3'),

  // Team notifications
  SLACK_WEBHOOK_URL: z.string().optional(),

  // Stripe webhooks (trigger.api from Stripe)
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof Env> & { configDir: string; filesDir: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const c = parsed.data;
  return { ...c, configDir: path.resolve(c.CONFIG_DIR), filesDir: path.resolve(c.FILES_DIR) };
}
