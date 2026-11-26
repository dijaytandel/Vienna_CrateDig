import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

describe('api', () => {
  it('GET /api/v1/health returns ok', async () => {
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await request(createApp()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('unhandled errors return a JSON 500 with no stack trace', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({
      configure: (v1) => {
        v1.get('/boom', () => {
          throw new Error('secret internals');
        });
      },
    });
    const res = await request(app).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(res.text).not.toContain('secret internals');
  });

  it('malformed JSON returns 400', async () => {
    const res = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('oversized JSON returns 413 in the error shape', async () => {
    const res = await request(createApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ x: 'a'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('ENTITY_TOO_LARGE');
  });
});
