import type { RequestHandler } from 'express';
import { HttpError } from './httpError.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};
