import crypto from 'node:crypto';

/**
 * Signed links a workflow can hand to customers or staff, e.g. a document
 * upload page tied to one client: {{ $uploadLink(trigger.client_id, "onboarding") }}
 */
let signer: { secret: string; base: string } | null = null;

export function configureLinks(secret: string, publicUrl: string) {
  signer = { secret, base: publicUrl.replace(/\/$/, '') };
}

const sign = (secret: string, body: string) => crypto.createHmac('sha256', secret).update(`upload:${body}`).digest('base64url').slice(0, 32);

export function uploadToken(ref: string, folder = 'uploads'): string {
  if (!signer) throw new Error('links are not configured');
  const body = Buffer.from(JSON.stringify({ ref: String(ref), folder })).toString('base64url');
  return `${body}.${sign(signer.secret, body)}`;
}

export function uploadLink(ref: string, folder?: string): string {
  return `${signer!.base}/upload/${uploadToken(ref, folder)}`;
}

export function readUploadToken(token: string): { ref: string; folder: string } | null {
  if (!signer) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = Buffer.from(sign(signer.secret, body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
