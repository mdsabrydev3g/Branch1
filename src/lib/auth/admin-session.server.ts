/**
 * Admin Password session — server-only.
 *
 * The app has ONE admin password, stored exclusively in the server-side
 * `ADMIN_PASSWORD` environment variable. It is never shipped to the browser,
 * never stored client-side, and never returned by any API.
 *
 * After a correct password the server mints a short-lived session token
 * (random 32 bytes, HMAC-SHA256 signed with a server secret) delivered as an
 * HttpOnly SameSite=Lax cookie. Client JavaScript can neither read the cookie
 * nor forge the token, and flipping zustand/localStorage state grants nothing:
 * every write server function re-verifies the signed cookie via
 * `requireAdminPassword` (see `roles.server.ts`).
 *
 * Signing secret resolution (server start): `ADMIN_SESSION_SECRET` env if set,
 * else derived from the admin password itself, else a per-process random key
 * (local dev / preview — sessions reset on restart, which is acceptable there).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  getCookie,
  getRequestProtocol,
  setResponseHeader,
} from "@tanstack/react-start/server";

export const ADMIN_COOKIE_NAME = "f1_admin_session";
/** Admin sessions last 8 hours — a workday. Re-login afterwards. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const configuredPassword = () => (process.env.ADMIN_PASSWORD ?? "").trim();

/** True when a real admin password has been configured server-side. */
export function adminPasswordConfigured(): boolean {
  return configuredPassword().length > 0;
}

/** Constant-time string comparison — no length leak, no early exit. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Compare against self to burn the same time, then fail.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Validate a submitted password against `ADMIN_PASSWORD`. */
export function verifyAdminPassword(submitted: string): boolean {
  const real = configuredPassword();
  if (!real) return false; // fail closed: unset password = nobody logs in
  const candidate = submitted.trim();
  if (!candidate || candidate.length > 1024) return false;
  return safeEqual(candidate, real);
}

// ── Token signing ────────────────────────────────────────────────────────────

function signingSecret(): Buffer {
  const explicit = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
  if (explicit) return Buffer.from(explicit, "utf8");
  const pw = configuredPassword();
  if (pw) return createHmac("sha256", "f1-admin-session-key").update(pw).digest();
  // No password configured — per-process random key (dev/preview only).
  const g = globalThis as typeof globalThis & { __f1AdminKey__?: Buffer };
  if (!g.__f1AdminKey__) g.__f1AdminKey__ = randomBytes(32);
  return g.__f1AdminKey__;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

/** Mint a signed session token valid for `SESSION_TTL_MS`. */
export function createSessionToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = randomBytes(32).toString("base64url");
  const payload = `${expiresAt}.${nonce}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

/** Verify a presented session token: correct signature AND not expired. */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const payload = `${expStr}.${nonce}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp > Date.now();
}

// ── Cookie handling (server functions) ──────────────────────────────────────

/** Read + verify the admin session from the incoming request cookie. */
export function hasAdminSessionFromCookie(): boolean {
  try {
    return verifySessionToken(getCookie(ADMIN_COOKIE_NAME));
  } catch {
    return false;
  }
}

/**
 * The `Secure` attribute is only valid on an HTTPS origin — a browser silently
 * drops a Secure cookie set over plain HTTP, which would make Admin Mode
 * impossible to establish on a local/preview http deployment. Emit it only
 * when the request genuinely arrived over TLS (h3 already honours
 * `x-forwarded-proto`, so this stays correct behind Vercel's proxy).
 */
function cookieFlags(): string {
  try {
    return getRequestProtocol() === "https" ? "; Secure" : "";
  } catch {
    // No request context (shouldn't happen in a server function): omit Secure
    // rather than risk a cookie the browser would discard.
    return "";
  }
}

/**
 * Emit `Set-Cookie` via the singular setter.
 *
 * `setResponseHeaders` iterates its argument with `Object.entries`, which
 * yields nothing for a `Headers` instance in Node (its entries are not own
 * enumerable properties) — so a `new Headers()` argument silently dropped the
 * admin session cookie and Admin Mode never stuck.
 */
function setCookieHeader(value: string): void {
  setResponseHeader("set-cookie", value);
}

/** Append the session Set-Cookie header to the server function response. */
export function issueSessionCookie(): void {
  const { token, expiresAt } = createSessionToken();
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  setCookieHeader(
    `${ADMIN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax${cookieFlags()}; Max-Age=${maxAge}`,
  );
}

/** Append the clearing Set-Cookie header (Exit Admin Mode). */
export function clearSessionCookie(): void {
  setCookieHeader(
    `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${cookieFlags()}; Max-Age=0`,
  );
}
