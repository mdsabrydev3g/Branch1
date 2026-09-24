/**
 * Realtime hub — server-only.
 *
 * The whole dashboard lives in ONE shared row (`dashboard_state`), and every
 * platform (web, Tauri, Capacitor) loads the SAME origin, so a single push
 * channel per client is all the app needs to keep them in step.
 *
 * A change is noticed in two ways:
 *
 * 1. `publishState()` — called by the write path in this very process, so
 *    clients attached to THIS serverless instance see it instantly (no DB
 *    round-trip at all).
 * 2. A revision ticker — every other instance notices "revision changed" with
 *    a few-byte `select revision` (never the document) and fans the new state
 *    out to its own subscribers.
 *
 * The ticker only runs while at least one client is subscribed, and the timer
 * is `unref()`ed so a serverless instance is never kept alive by it.
 */
import type { Sql } from "@/lib/db";

export type SyncEvent = {
  /** Monotonic `dashboard_state.revision` — also the SSE `id:` used to resume. */
  revision: number;
  /** Present when the sender already had the state in hand (no extra DB read). */
  state?: unknown;
  ts: number;
};

export interface SyncSubscriber {
  id: string;
  send: (event: SyncEvent) => void;
}

/** Cheap enough to feel instant; the only cross-instance cost is this one query. */
const POLL_MS = 700;
const ERROR_LOG_INTERVAL_MS = 60_000;

interface HubState {
  subscribers: Map<string, SyncSubscriber>;
  timer?: ReturnType<typeof setInterval>;
  /** Last revision this process knows about — the ticker's change detector. */
  lastRevision: number;
  inFlight: boolean;
  lastErrorAt: number;
  seq: number;
}

/**
 * Init state on `globalThis` for the same reason `src/lib/db.ts` does: dev HMR
 * creates fresh module instances, and two hubs would mean two tickers and
 * duplicate fan-out.
 */
const globalRef = globalThis as typeof globalThis & {
  __f1RealtimeHub__?: HubState;
};

function hub(): HubState {
  globalRef.__f1RealtimeHub__ ??= {
    subscribers: new Map(),
    lastRevision: 0,
    inFlight: false,
    lastErrorAt: 0,
    seq: 0,
  };
  return globalRef.__f1RealtimeHub__;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/realtime/hub.server is server-only — import it from a server route " +
        "or a createServerFn handler, never from a component.",
    );
  }
}

/** How many clients this instance is currently pushing to (diagnostics only). */
export function subscriberCount(): number {
  return hub().subscribers.size;
}

/**
 * Register a subscriber. The returned function MUST be called when the client
 * goes away (request abort / stream closed), otherwise the fan-out list grows.
 */
export function subscribe(send: (event: SyncEvent) => void): () => void {
  assertServerOnly();
  const state = hub();
  const id = `sub-${++state.seq}`;
  state.subscribers.set(id, { id, send });
  startTicker();
  return () => {
    state.subscribers.delete(id);
    if (state.subscribers.size === 0) stopTicker();
  };
}


/**
 * Fan a change out to this instance's subscribers.
 *
 * Called straight from the write path, where the state is already serialized —
 * best effort by design: realtime must never be able to fail a manager's save.
 */
export function publishState(revision: number, state?: unknown): void {
  assertServerOnly();
  if (!Number.isFinite(revision) || revision <= 0) return;
  const h = hub();
  if (revision > h.lastRevision) h.lastRevision = revision;
  if (h.subscribers.size === 0) return;
  const event: SyncEvent = { revision, state, ts: Date.now() };
  for (const sub of [...h.subscribers.values()]) {
    try {
      sub.send(event);
    } catch {
      // A dead subscriber (aborted stream) must not break the others.
      h.subscribers.delete(sub.id);
    }
  }
}

/** The stored shared state + revision, or null when the row does not exist yet. */
export async function readStoredState(): Promise<{ revision: number; state: unknown } | null> {
  assertServerOnly();
  const sql = await getSqlRef();
  const rows = await sql<{ revision: number; state: unknown }>`
    select revision, state from dashboard_state where state_key = 'main'
  `;
  const row = rows[0];
  if (!row) return null;
  const revision = Number(row.revision) || 1;
  const h = hub();
  if (revision > h.lastRevision) h.lastRevision = revision;
  return { revision, state: row.state };
}

async function getSqlRef(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function startTicker(): void {
  const h = hub();
  if (h.timer) return;
  h.timer = setInterval(() => {
    void tick();
  }, POLL_MS);
  // Never hold a serverless instance open on our account.
  (h.timer as unknown as { unref?: () => void }).unref?.();
}

function stopTicker(): void {
  const h = hub();
  if (!h.timer) return;
  clearInterval(h.timer);
  h.timer = undefined;
}

/**
 * One change-detector pass: read the revision (a few bytes), and only when it
 * moved read the document once and hand it to every subscriber. Clients that
 * already have that revision ignore the event, so a redundant broadcast on a
 * slow instance costs nothing.
 */
async function tick(): Promise<void> {
  const h = hub();
  if (h.inFlight || h.subscribers.size === 0) return;
  h.inFlight = true;
  try {
    const sql = await getSqlRef();
    const rows = await sql<{ revision: number }>`
      select revision from dashboard_state where state_key = 'main'
    `;
    const revision = Number(rows[0]?.revision) || 0;
    if (revision <= 0 || revision === h.lastRevision) return;
    const fresh = await readStoredState();
    if (!fresh) return;
    publishState(fresh.revision, fresh.state);
  } catch (err) {
    // Throttled: a cold/offline database must not spam the function logs.
    const now = Date.now();
    if (now - h.lastErrorAt > ERROR_LOG_INTERVAL_MS) {
      h.lastErrorAt = now;
      console.error("[realtime] revision ticker failed:", err);
    }
  } finally {
    h.inFlight = false;
  }
}
