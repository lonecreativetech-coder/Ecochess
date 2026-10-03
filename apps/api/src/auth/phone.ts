export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const cleaned = input.replace(/[\s\-()]/g, '');
  if (/^0\d{10}$/.test(cleaned)) {
    return `+234${cleaned.slice(1)}`;
  }
  if (/^234\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (/^\+\d{8,15}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}
