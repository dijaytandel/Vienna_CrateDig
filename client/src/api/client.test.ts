import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('apiGet', () => {
  it('rejects an HTML page served in place of the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }),
      ),
    );
    await expect(apiGet('/stores?zip=97205')).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('surfaces API error codes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'ZIP_NOT_FOUND', message: 'No ZIP' } }), {
            status: 404,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }),
      ),
    );
    await expect(apiGet('/stores?zip=82715')).rejects.toMatchObject({
      status: 404,
      code: 'ZIP_NOT_FOUND',
      message: 'No ZIP',
    });
  });
});
