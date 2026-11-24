import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "../lib/jwt";
import { forbidden, unauthorized } from "../lib/http-error";
import { findUserById } from "../db/users";

// Populates req.userId when a valid auth cookie is present, but does not
// reject the request otherwise. Use requireAuth to enforce authentication.
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (token) {
    try {
      req.userId = verifyAuthToken(token).userId;
    } catch {
      // invalid/expired token — treated as signed out
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) {
    next(unauthorized());
    return;
  }
  next();
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) {
    next(unauthorized());
    return;
  }
  try {
    const user = await findUserById(req.userId);
    if (!user?.is_admin) {
      next(forbidden("admin_only"));
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
