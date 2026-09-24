/**
 * Realtime push endpoint — Server-Sent Events.
 *
 * Why SSE and not a WebSocket: updates only ever flow server -> client here
 * (every write stays behind the admin-gated `createServerFn`), so a plain HTTP
 * stream is enough — no upgrade handshake, no client library, and
 * `EventSource` reconnects on its own and replays `Last-Event-ID` for a
 * gap-free resume. The stream is same-origin, so the existing HttpOnly admin
 * cookie keeps working untouched.
 *
 * Each event carries the new revision and (when the writer had it in hand) the
 * state itself, so a client applies the change without any extra round-trip.
 * When the state is missing the client falls back to the existing
 * `loadDashboardState` server function.
 *
 * Vercel ends the invocation at its function max duration; that is fine and
 * expected: the browser reconnects immediately and the `since`/Last-Event-ID
 * cursor makes the handover invisible.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  readStoredState,
  subscriberCount,
  subscribe,
} from "@/lib/realtime/hub.server";

/** Keeps NAT/proxy idle timeouts from silently killing the stream. */
const HEARTBEAT_MS = 20_000;
/** Close before the platform's function limit so the client reconnects on our terms. */
const MAX_STREAM_MS = 280_000;

const STREAM_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-store, no-transform",
  "x-accel-buffering": "no",
  connection: "keep-alive",
} as const;

export const Route = createFileRoute("/api/realtime")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);

        // Same-origin only: browsers already refuse a cross-origin EventSource
        // without CORS, and this makes the intent explicit server-side.
        const origin = request.headers.get("origin");
        if (origin) {
          try {
            if (new URL(origin).host !== url.host) {
              return new Response("Forbidden", { status: 403 });
            }
          } catch {
            return new Response("Forbidden", { status: 403 });
          }
        }

        const since =
          Number(url.searchParams.get("since") ?? request.headers.get("last-event-id") ?? 0) ||
          0;
        let lastSent = since;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const encoder = new TextEncoder();
            let closed = false;

            const write = (chunk: string) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(chunk));
              } catch {
                closed = true;
              }
            };
            const send = (event: { revision: number; state?: unknown; ts: number }) => {
              write(
                `id: ${event.revision}\nevent: sync\ndata: ${JSON.stringify(event)}\n\n`,
              );
            };

            // Ask the browser for a fast reconnect (it also auto-retries on its own).
            write("retry: 1500\n\n");

            // Catch-up: a client that was offline/backgrounded may have missed
            // changes while NO instance had it subscribed. One read on connect
            // guarantees convergence far more reliably than replaying history.
            try {
              const stored = await readStoredState();
              if (stored && stored.revision > lastSent) {
                lastSent = stored.revision;
                send({ revision: stored.revision, state: stored.state, ts: Date.now() });
              }
            } catch {
              // Database hiccup: stay connected, the ticker will catch up.
            }

            write(
              `event: ready\ndata: ${JSON.stringify({ revision: lastSent, clients: subscriberCount() })}\n\n`,
            );

            const unsubscribe = subscribe((event) => {
              if (event.revision <= lastSent) return;
              lastSent = event.revision;
              send(event);
            });

            const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
            const stop = () => {
              if (closed) return;
              closed = true;
              clearInterval(heartbeat);
              clearTimeout(ttl);
              unsubscribe();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            };
            const ttl = setTimeout(stop, MAX_STREAM_MS);
            request.signal.addEventListener("abort", stop);
          },
        });

        return new Response(stream, { headers: STREAM_HEADERS });
      },
    },
  },
});
