const BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** GETs a CrateDig API path; failures become an ApiError carrying the API's error code. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach CrateDig. Check your connection.");
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? 'Something went wrong. Try again.',
    );
  }
  return body as T;
}
