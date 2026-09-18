import { Router } from "express";
import { z } from "zod";
import { checkAdminPassword, issueAdminToken } from "../lib/auth";

export const adminRouter = Router();

const LoginSchema = z.object({ password: z.string() });

// POST /admin/login — public (it's the login itself). Returns a JWT that
// web/'s /api/admin/login route stores as an httpOnly cookie — this
// service never sets cookies itself, since it has no concept of "the
// browser," only of "a bearer token." See
// docs/adr/0004-service-boundary.md.
adminRouter.post("/login", (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  const password = parsed.success ? parsed.data.password : undefined;

  if (!password || !checkAdminPassword(password)) {
    // Same generic message either way — don't confirm whether a password
    // was even submitted, let alone whether it was close to correct.
    res.status(401).json({ errors: ["Invalid password."] });
    return;
  }

  res.json({ token: issueAdminToken() });
});
