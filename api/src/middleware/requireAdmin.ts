import type { NextFunction, Request, Response } from "express";
import { verifyAdminToken } from "../lib/auth";

/**
 * Every admin route in this service re-verifies the bearer token itself
 * — there's no gateway or proxy in front of this service that's trusted
 * to have already checked it. (web/'s proxy.ts does an *optimistic*
 * "is there a cookie at all" check before rendering /admin/* — it can't
 * verify the JWT signature without this service's JWT_SECRET, by design;
 * see docs/adr/0004-service-boundary.md. This middleware is the actual
 * authorization boundary.)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!verifyAdminToken(token)) {
    res.status(401).json({ errors: ["Unauthorized."] });
    return;
  }

  next();
}
