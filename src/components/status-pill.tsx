import { cn } from "@/lib/utils";
import { statusOf, type StatusTone } from "@/lib/domain";

const TONE: Record<StatusTone, string> = {
  good: "bg-success/12 text-success border-success/30",
  watch: "bg-warning/12 text-warning border-warning/30",
  bad: "bg-danger/12 text-danger border-danger/30",
};

const TONE_GLOW: Record<StatusTone, string> = {
  good: "shadow-[0_0_15px_rgba(78,201,155,0.3)]",
  watch: "shadow-[0_0_15px_rgba(232,180,94,0.3)]",
  bad: "shadow-[0_0_15px_rgba(240,128,128,0.3)]",
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
