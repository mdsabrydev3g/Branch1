/**
 * Server-side roles: the ONLY place authorization decisions are made.
 *
 * Admin authorization = a valid signed admin-session cookie (minted by
 * `adminLogin` after a correct `ADMIN_PASSWORD`). The client's `role` state is
 * a UI hint only — every server write re-verifies the session here, so editing
 * React/zustand/localStorage state or calling the API directly grants nothing.
 */
import { hasAdminSessionFromCookie } from "./admin-session.server";

export type AppRole = "admin" | "staff";

/**
 * Thrown by `requireAdmin` when the caller has no valid admin session.
 * Message is a stable contract the client matches to show a friendly error.
 */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/**
 * The authorization gate for every write operation: verifies the signed,
 * HttpOnly admin-session cookie server-side. No cookie / bad signature /
 * expired session -> 403. There is deliberately no dev bypass: the gate fails
 * closed whenever `ADMIN_PASSWORD` is unset.
 */
export async function requireAdmin(): Promise<void> {
  if (!hasAdminSessionFromCookie()) throw new ForbiddenError();
}
