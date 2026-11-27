import { Platform } from 'react-native';

const DEFAULT_BASE_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/v1'
    : 'http://localhost:3000/v1';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_BASE_URL;

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

interface Envelope<T> {
  data: T;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown> | null;
}

let currentAccessToken: string | null = null;
let onRefreshTokenNeeded: (() => Promise<string | null>) | null = null;

export function setApiAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export function setTokenRefresher(
  fn: (() => Promise<string | null>) | null,
): void {
  onRefreshTokenNeeded = fn;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    isFormData?: boolean;
    retryOn401?: boolean;
  } = {},
): Promise<Envelope<T>> {
  const {
    method = 'GET',
    body,
    isFormData = false,
    retryOn401 = true,
  } = options;

  const headers: Record<string, string> = {};
  if (currentAccessToken) {
    headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
  });

  if (response.status === 401 && retryOn401 && onRefreshTokenNeeded) {
    const newToken = await onRefreshTokenNeeded();
    if (newToken) {
      return apiRequest<T>(path, { ...options, retryOn401: false });
    }
  }

  const json = (await response.json()) as Envelope<T>;
  if (!response.ok || json.error) {
    throw new ApiClientError(
      json.error?.code ?? 'HTTP_ERROR',
      json.error?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return json;
}
