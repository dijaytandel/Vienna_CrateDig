import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthService, AuthUser } from '../auth/service.js';
import { HttpError } from './httpError.js';

export const currentUser = (res: Response) => res.locals.user as AuthUser;
export const currentStoreId = (res: Response) => res.locals.storeId as string;

function bearer(req: Request) {
  const match = /^Bearer (\S+)$/i.exec(req.get('authorization') ?? '');
  return match?.[1];
}

/** 401 unless the request carries a valid Supabase access token. */
export function requireAuth(auth?: AuthService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearer(req);
    if (!token) {
      res.set('WWW-Authenticate', 'Bearer');
      throw new HttpError(401, 'UNAUTHENTICATED', 'Log in to do this');
    }
    if (!auth) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured');
    const user = await auth.userFromToken(token);
    if (!user) {
      res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired, log in again');
    }
    res.locals.user = user;
    next();
  };
}

/** 403 unless the caller is a store manager of a verified store; exposes that store's id. */
export function requireVerifiedManager(auth?: AuthService): RequestHandler[] {
  return [
    requireAuth(auth),
    async (_req: Request, res: Response, next: NextFunction) => {
      const user = currentUser(res);
      const storeId = user.role === 'store_manager' ? await auth!.verifiedStoreId(user.id) : null;
      if (!storeId) {
        throw new HttpError(403, 'FORBIDDEN', 'Only the verified manager of a store can do this');
      }
      res.locals.storeId = storeId;
      next();
    },
  ];
}
