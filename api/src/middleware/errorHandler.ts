import type { ErrorRequestHandler } from 'express';
import { HttpError } from './httpError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  const status = Number(err?.status ?? err?.statusCode);
  if (err?.expose && status >= 400 && status < 500) {
    const code = String(err.type ?? 'bad_request')
      .replace(/[^a-z0-9]+/gi, '_')
      .toUpperCase();
    res.status(status).json({ error: { code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
