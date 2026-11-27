export interface ApiError {
  code: string;
  message: string;
}

export interface Envelope<T> {
  data: T;
  error: ApiError | null;
  meta: Record<string, unknown> | null;
}

export function ok<T>(
  data: T,
  meta: Record<string, unknown> | null = null,
): Envelope<T> {
  return { data, error: null, meta };
}
