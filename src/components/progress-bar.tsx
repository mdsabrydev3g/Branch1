import { cn } from "@/lib/utils";
import { statusOf } from "@/lib/domain";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  const tone = statusOf(value).tone;

  const TONE_COLOR: Record<string, string> = {
    good: "bg-success",
    watch: "bg-warning",
    bad: "bg-danger",
  };

  const TONE_GLOW: Record<string, string> = {
    good: "shadow-[0_0_10px_rgba(78,201,155,0.5)]",
    watch: "shadow-[0_0_10px_rgba(232,180,94,0.5)]",
    bad: "shadow-[0_0_10px_rgba(240,128,128,0.5)]",
  };

  return (
    <div
      className={cn(
        "h-2 overflow-hidden rounded-full bg-card-3",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          TONE_COLOR[tone],
          TONE_GLOW[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
