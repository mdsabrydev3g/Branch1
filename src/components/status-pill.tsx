import { cn } from "@/lib/utils";
import { statusOf, type StatusTone } from "@/lib/domain";

const TONE: Record<StatusTone, string> = {
  excellent: "bg-emerald-400/15 text-emerald-300 border-emerald-300/40",
  vgood: "bg-emerald-400/10 text-emerald-200 border-emerald-300/30",
  good: "bg-success/12 text-success border-success/30",
  willdo: "bg-warning/12 text-warning border-warning/30",
  danger: "bg-danger/12 text-danger border-danger/30",
};

const TONE_GLOW: Record<StatusTone, string> = {
  excellent: "shadow-[0_0_15px_rgba(52,211,153,0.35)]",
  vgood: "shadow-[0_0_15px_rgba(52,211,153,0.2)]",
  good: "shadow-[0_0_15px_rgba(78,201,155,0.3)]",
  willdo: "shadow-[0_0_15px_rgba(232,180,94,0.3)]",
  danger: "shadow-[0_0_15px_rgba(240,128,128,0.3)]",
};

export function StatusPill({
  ratio,
  report = false,
  compact = false,
}: {
  ratio: number;
  report?: boolean;
  compact?: boolean;
}) {
  const s = statusOf(ratio);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide transition-all duration-300",
        compact ? "h-5 whitespace-nowrap px-1.5 text-[10px]" : "h-7 px-3 text-xs",
        TONE[s.tone],
        TONE_GLOW[s.tone],
      )}
    >
      {report ? s.report : s.label}
    </span>
  );
}
