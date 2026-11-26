const BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;

/** Set by the auth provider so API calls carry the signed-in user's token. */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export const isOfflineError = (err: unknown) => err instanceof ApiError && err.status === 0;

interface RequestOptions {
  signal?: AbortSignal;
  idempotencyKey?: string;
}

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  { signal, idempotencyKey }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach CrateDig. Check your connection.");
  }

  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false;
  const json = (isJson ? await res.json().catch(() => null) : null) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? 'HTTP_ERROR',
      json?.error?.message ?? 'Something went wrong. Try again.',
      json?.error?.details,
    );
  }

  if (json === null) {
    throw new ApiError(
      res.status,
      'BAD_RESPONSE',
      'CrateDig sent an unexpected response. Try again.',
    );
  }

  return json as T;
}

/** GETs a CrateDig API path; failures become an ApiError carrying the API's error code. */
export const apiGet = <T>(path: string, signal?: AbortSignal) =>
  request<T>('GET', path, undefined, { signal });

export const apiSend = <T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options?: RequestOptions,
) => request<T>(method, path, body, options);

export const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';
