/**
 * Client half of the realtime layer — ONE connection per tab/app, shared by
 * every view.
 *
 * `startRealtimeSync()` is called once from the app shell. From then on the
 * server pushes every change to this client, which applies it to the existing
 * zustand store — no page reload, no full refetch unless the pushed event had
 * no state attached.
 *
 * Failure handling is deliberately boring: reconnect with capped backoff, a
 * watchdog that reconnects when the stream goes quiet, and `navigator.onLine`
 * awareness. If the stream cannot be held at all, the app shell keeps its
 * polling fallback and everything still works — just slower.
 */
import { usePerfStore } from "@/lib/store";
import { syncStatus, useSyncStatus } from "@/lib/realtime/status";

const STREAM_URL = "/api/realtime";
const MIN_RETRY_MS = 1000;
const MAX_RETRY_MS = 20_000;
/** No event/heartbeat for this long => assume a half-open connection. */
const STALE_MS = 55_000;
const WATCHDOG_MS = 15_000;

let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let watchdogTimer: ReturnType<typeof setInterval> | undefined;
let listening = false;

type SyncPayload = { revision?: number; state?: unknown };

function scheduleReconnect(): void {
  if (retryTimer || !listening) return;
  const attempts = syncStatus().attempts + 1;
  useSyncStatus.getState().registerAttempt(attempts);
  // Exponential with jitter, so N clients coming back after a deploy/drop
  // never reconnect in lockstep.
  const base = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** (attempts - 1));
  const delay = Math.round(base * (0.75 + Math.random() * 0.5));
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    connect();
  }, delay);
}

function closeStream(): void {
  if (!source) return;
  try {
    source.close();
  } catch {
    /* already closed */
  }
  source = null;
}

function armWatchdog(): void {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    const { lastEventAt, status } = syncStatus();
    if (status === "offline") return;
    if (lastEventAt > 0 && Date.now() - lastEventAt > STALE_MS) {
      // Half-open socket (mobile NAT, laptop sleep): force a clean reconnect.
      connect();
    }
  }, WATCHDOG_MS);
  (watchdogTimer as unknown as { unref?: () => void }).unref?.();
}

function clearWatchdog(): void {
  if (!watchdogTimer) return;
  clearInterval(watchdogTimer);
  watchdogTimer = undefined;
}

function refreshOnReturn(): void {
  // A backgrounded tab/app may have missed events entirely (JS suspended), so
  // this is a real catch-up, not a "maybe".
  void usePerfStore.getState().syncRemote();
  if (!source) connect();
}

function onOnline(): void {
  if (!listening) return;
  connect();
  refreshOnReturn();
}

function onOffline(): void {
  useSyncStatus.getState().setStatus("offline");
  closeStream();
}

function onVisibility(): void {
  if (!listening) return;
  if (document.visibilityState === "visible") {
    refreshOnReturn();
  } else {
    // Keep the stream alive so Capacitor can receive the event while backgrounded.
  }
}

/** Start the push channel. Returns the teardown used by the app shell. */
export function startRealtimeSync(): () => void {
  if (typeof window === "undefined") return () => {};
  if (listening) return stopRealtimeSync;
  listening = true;
  useSyncStatus.getState().setTransport("sse");
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisibility);
  connect();
  return stopRealtimeSync;
}

export function stopRealtimeSync(): void {
  listening = false;
  clearWatchdog();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = undefined;
  closeStream();
  if (typeof window !== "undefined") {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisibility);
  }
}

/** True when the push channel is healthy — the app shell stops polling then. */
export function isRealtimeLive(): boolean {
  return syncStatus().status === "live";
}

/** Pull the freshest state right now (used on focus and by "sync now" actions). */
export function resyncNow(): void {
  if (typeof window === "undefined") return;
  void usePerfStore.getState().syncRemote();
  if (!source) connect();
}


function handleEvent(raw: string): void {
  let payload: SyncPayload;
  try {
    payload = JSON.parse(raw) as SyncPayload;
  } catch {
    return;
  }
  const revision = Number(payload.revision) || 0;
  const store = usePerfStore.getState();

  // Our own writes come back on this stream too — applying them is a no-op,
  // which is exactly what makes the echo harmless.
  if (payload.state === undefined) {
    if (revision > 0 && revision <= syncStatus().lastRevision) return;
    useSyncStatus.getState().markEvent(revision);
    void store.syncRemote();
    return;
  }

  useSyncStatus.getState().markEvent(revision);
  store.applyRemote(payload.state);
}

function connect(): void {
  if (!listening) return;
  closeStream();
  if (typeof EventSource === "undefined") return;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    useSyncStatus.getState().setStatus("offline");
    return; // the `online` listener reconnects us
  }

  useSyncStatus.getState().setTransport("sse");
  const since = syncStatus().lastRevision;

  let stream: EventSource;
  try {
    stream = new EventSource(`${STREAM_URL}?since=${since}`);
  } catch {
    useSyncStatus.getState().setStatus("offline");
    scheduleReconnect();
    return;
  }
  source = stream;

  stream.addEventListener("open", () => {
    if (source !== stream) return;
    useSyncStatus.getState().registerAttempt(0);
    useSyncStatus.getState().setStatus("live");
  });

  stream.addEventListener("ready", () => {
    if (source !== stream) return;
    useSyncStatus.getState().setStatus("live");
    useSyncStatus.getState().markEvent(syncStatus().lastRevision);
    armWatchdog();
  });

  stream.addEventListener("sync", (event) => {
    if (source !== stream) return;
    armWatchdog();
    handleEvent((event as MessageEvent<string>).data);
  });

  stream.addEventListener("error", () => {
    if (source !== stream) return;
    useSyncStatus.getState().setStatus("offline");
    closeStream();
    scheduleReconnect();
  });
}

