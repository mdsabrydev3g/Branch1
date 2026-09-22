/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * DISABLED: Admin Edit Mode uses ONE server-side `ADMIN_PASSWORD` plus a signed
 * HttpOnly session cookie (see `admin-session.server.ts`). No email accounts,
 * registration, or user management exist for this app, so the email/password
 * provider stays off — less attack surface, nothing unused running.
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = false;
