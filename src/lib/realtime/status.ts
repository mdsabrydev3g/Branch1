/**
 * Connection status for the realtime layer.
 *
 * Deliberately its own tiny store: the SSE client touches it on every
 * reconnect/heartbeat, and keeping that out of `usePerfStore` means the big
 * dashboard store never re-renders because of transport bookkeeping.
 *
 * SSR-safe — no browser API is referenced here.
 */
import { create } from "zustand";

export type SyncStatus = "connecting" | "live" | "offline";
export type SyncTransport = "sse" | "polling";

export interface SyncStatusState {
  status: SyncStatus;
  transport: SyncTransport;
  /** Highest revision this client has applied (also the SSE resume cursor). */
  lastRevision: number;
  /** Last time an event (or catch-up) arrived — drives the "synced Xs ago" text. */
  lastEventAt: number;
  /** How many times we re-connected in a row; 0 while healthy. */
  attempts: number;
  setStatus: (status: SyncStatus) => void;
  setTransport: (transport: SyncTransport) => void;
  markEvent: (revision: number) => void;
  registerAttempt: (attempts: number) => void;
}

export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: "connecting",
  transport: "sse",
  lastRevision: 0,
  lastEventAt: 0,
  attempts: 0,
  setStatus: (status) => set({ status }),
  setTransport: (transport) => set({ transport }),
  markEvent: (revision) =>
    set((state) => ({
      lastEventAt: Date.now(),
      lastRevision: revision > 0 ? Math.max(state.lastRevision, revision) : state.lastRevision,
    })),
  registerAttempt: (attempts) => set({ attempts }),
}));

/** Non-reactive read, for callbacks and the resync helpers. */
export function syncStatus(): SyncStatusState {
  return useSyncStatus.getState();
}
