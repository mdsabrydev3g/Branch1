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
  return (
    <div
      className={cn(
        "h-1.5 overflow-hidden rounded-full bg-card-3",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-out",
          tone === "good" && "bg-success",
          tone === "watch" && "bg-warning",
          tone === "bad" && "bg-danger",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
