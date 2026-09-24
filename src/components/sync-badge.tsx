import { useSyncStatus } from "@/lib/realtime/status";
import { cn } from "@/lib/utils";

const TONE = {
  live: "bg-success",
  connecting: "bg-warning",
  offline: "bg-danger",
} as const;

const LABEL = { live: "Live", connecting: "Syncing", offline: "Offline" } as const;

const HINT = {
  live: "Live — any change made here or on another device appears instantly",
  connecting: "Connecting to the live sync channel…",
  offline: "No live connection — showing the last data received",
} as const;

/**
 * مؤشر حالة التزامن بين الأجهزة. عنصر صغير في الشريط العلوي: نقطة ملوّنة
 * وكلمة قصيرة على الشاشات الأكبر، ولا يمس أي حساب أو تخطيط موجود.
 */
export function SyncBadge() {
  const status = useSyncStatus((s) => s.status);
  const transport = useSyncStatus((s) => s.transport);

  return (
    <span
      role="status"
      aria-live="polite"
      title={`${HINT[status]}${transport === "polling" ? " (fallback)" : ""}`}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2"
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          TONE[status],
          status !== "live" && "animate-pulse",
        )}
      />
      <span className="hidden text-2xs font-semibold text-muted sm:inline">{LABEL[status]}</span>
    </span>
  );
}
