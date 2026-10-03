import { createHmac } from 'node:crypto';

export function hashOtp(identifier: string, code: string): string {
  const secret = process.env.HASH_SECRET;
  if (!secret) {
    throw new Error('HASH_SECRET is not set. Check apps/api/.env');
  }
  return createHmac('sha256', secret)
    .update(`${identifier}:${code}`)
    .digest('hex');
}
