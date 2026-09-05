import { cn } from "@/lib/utils";
import { statusOf, type StatusTone } from "@/lib/domain";

const TONE: Record<StatusTone, string> = {
  good: "bg-success/12 text-success",
  watch: "bg-warning/12 text-warning",
  bad: "bg-danger/12 text-danger",
};

export function StatusPill({
  ratio,
  report = false,
}: {
  ratio: number;
  report?: boolean;
}) {
  const s = statusOf(ratio);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold tracking-wide",
        TONE[s.tone],
      )}
    >
      {report ? s.report : s.label}
    </span>
  );
}
