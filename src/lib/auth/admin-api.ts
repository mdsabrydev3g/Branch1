/**
 * Admin Password API — server functions for the ONE-password Admin Mode.
 *
 * Flow: the dialog sends the plaintext ONCE to the same-origin `adminLogin`
 * server function; the server compares it (timing-safe) against the
 * `ADMIN_PASSWORD` env var and, on success, sets a signed HttpOnly session
 * cookie. The plaintext is never stored client-side, never echoed back, and
 * never used again after login. Every admin write server function re-verifies
 * the session server-side via `requireAdmin` (roles.server.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  adminPasswordConfigured,
  clearSessionCookie,
  hasAdminSessionFromCookie,
  issueSessionCookie,
  verifyAdminPassword,
} from "./admin-session.server";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required").max(1024),
});

/** Sign in with the ONE admin password. Sets the HttpOnly session cookie. */
export const adminLogin = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    if (!adminPasswordConfigured()) {
      return {
        ok: false as const,
        error: "Admin access is not configured. Set ADMIN_PASSWORD on the server.",
      };
    }
    // Small constant-ish delay to blunt brute-force attempts.
    await new Promise((r) => setTimeout(r, 250));
    if (!verifyAdminPassword(data.password)) {
      return { ok: false as const, error: "Incorrect Manager Password" };
    }
    issueSessionCookie();
    return { ok: true as const };
  });

/** Is the current browser holding a valid admin session? */
export const getAdminSession = createServerFn({ method: "GET" }).handler(
  async () => ({ isAdmin: hasAdminSessionFromCookie() }),
);

/** Exit Admin Mode: clear the session cookie server-side. */
export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  clearSessionCookie();
  return { ok: true as const };
});
