import { createHmac } from 'node:crypto';

function getSecret(): string {
  const secret = process.env.HASH_SECRET;
  if (!secret) {
    throw new Error('HASH_SECRET is not set. Check apps/api/.env');
  }
  return secret;
}

export function hashOtp(identifier: string, code: string): string {
  return createHmac('sha256', getSecret())
    .update(`${identifier}:${code}`)
    .digest('hex');
}

export function hashToken(token: string): string {
  return createHmac('sha256', getSecret())
    .update(`refresh:${token}`)
    .digest('hex');
}
