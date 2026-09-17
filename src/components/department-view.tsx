import { useMemo, type ReactNode } from "react";
import {
  DEP_COPY,
  DEP_SHORT,
  calculate85PercentTarget,
  calculate80PercentTarget,
  calculateDailyTarget,
  calculateFirstHalfTarget,
  calculateRemaining,
  calculateSecondHalfTarget,
  calculateTrackTarget,
  firstHalfActualFromDaily,
  formatNumber,
  formatPct,
  getDaysInMonth,
  getTrackDay,
  localDateString,
  monthActualFromDaily,
  ratio,
  showSecondHalf,
  statusOf,
  sumBlock,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";

/** زوج كارتين جنب بعض بخط فاصل واضح بينهم.
 *  على الشاشات الصغيرة بيترصوا فوق بعض عشان مفيش سكرول يمين/شمال. */
const SPLIT_BP = {
  md: { grid: "md:grid-cols-[1fr_auto_1fr]", div: "md:block" },
  xl: { grid: "xl:grid-cols-[1fr_auto_1fr]", div: "xl:block" },
} as const;

type SplitBp = keyof typeof SPLIT_BP;

export function SplitPair({
  left,
  right,
  bp = "md",
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  bp?: SplitBp;
  className?: string;
}) {
  const b = SPLIT_BP[bp];
  return (
    <div className={cn("grid items-stretch gap-4", b.grid, className)}>
      <div className="min-w-0">{left}</div>
      <div aria-hidden="true" className={cn("hidden w-px self-stretch bg-border", b.div)} />
      <div className="min-w-0">{right}</div>
    </div>
  );
}

type MetricItem = { label: string; value: string; accent?: string };

function MetricBoxes({ items }: { items: MetricItem[] }) {
  return (
    <div
      className={cn(
        "grid gap-3 text-center",
        items.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3",
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl bg-card-2/50 p-3 sm:p-4">
          <span className="block truncate text-2xs uppercase tracking-wider text-subtle">
            {item.label}
          </span>
          <p
            className={cn(
              "mt-1 truncate font-mono text-sm font-bold tabular-nums sm:text-base",
              item.accent ?? "text-foreground",
            )}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function toneClass(tone: ReturnType<typeof statusOf>["tone"]) {
  return tone === "good"
    ? "text-success"
    : tone === "watch"
      ? "text-warning"
      : "text-danger";
}

/** Small progress ring: actual ÷ total target inside. */
function MiniRing({ value }: { value: number }) {
  const fill = Math.min(1, Math.max(0, value));
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = c * fill;
  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-card-3)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="7"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
    </div>
  );
}

function TrackCard({
  target,
  actual,
  totalTarget,
  day,
  className,
}: {
  target: number;
  actual: number;
  totalTarget: number;
  day: number;
  className?: string;
}) {
  const gap = actual - target;
  const r = ratio({ plan: target, result: actual });
  const ringRatio = ratio({ plan: totalTarget, result: actual });
  const gapAccent = gap > 0 ? "text-success" : gap < 0 ? "text-danger" : "text-warning";
  return (
    <section
      className={cn(
        "hairline print-surface gradient-border flex h-full flex-col rounded-2xl bg-card/90 p-5 sm:p-6 card-hover",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <MiniRing value={ringRatio} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">Track until yesterday</h2>
          <p className="text-xs text-subtle">Cumulative target through day {day}</p>
        </div>
        <StatusPill ratio={r} />
      </div>
      <MetricBoxes
        items={[
          { label: "Track target", value: formatNumber(target) },
          { label: "Actual through yesterday", value: formatNumber(actual) },
          {
            label: "Gap",
            value: `${gap > 0 ? "+" : ""}${formatNumber(gap)}`,
            accent: gapAccent,
          },
        ]}
      />
      <div className="mt-auto pt-4">
        <div className="mb-2 flex justify-between text-xs text-subtle">
          <span className="font-medium">Actual / Track</span>
          <span className="font-semibold text-foreground">{formatPct(r)}</span>
        </div>
        <ProgressBar value={r} />
      </div>
    </section>
  );
}

function HalfCard({
  title,
  subtitle,
  target,
  actual,
}: {
  title: string;
  subtitle: string;
  target: number;
  actual: number;
}) {
  const achievement = ratio({ plan: target, result: actual });
  return (
    <section className="hairline print-surface gradient-border h-full rounded-2xl bg-card/90 p-5 sm:p-6 card-hover">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-subtle">{subtitle}</p>
        </div>
        <StatusPill ratio={achievement} />
      </div>
      <MetricBoxes
        items={[
          { label: "Target", value: formatNumber(target) },
          { label: "Actual", value: formatNumber(actual) },
          { label: "Remaining", value: formatNumber(calculateRemaining(target, actual)) },
        ]}
      />
      <div className="mt-4">
        <div className="mb-2 flex justify-between text-xs text-subtle">
          <span className="font-medium">Achievement</span>
          <span className="font-semibold text-foreground">{formatPct(achievement)}</span>
        </div>
        <ProgressBar value={achievement} />
      </div>
    </section>
  );
}

export function DepartmentGroupView({ title, deps }: { title: string; deps: string[] }) {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);

  const today = localDateString();
  const block = data[period] ?? {};
  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period, today);
  const visibleSecond = showSecondHalf(period, today);

  const depStats = useMemo(() => {
    return deps.map((dep) => {
      const depKey = dep as Dep;
      const fallback = block[depKey] ? sumBlock(block[depKey]) : { plan: 0, result: 0 };
      const daily = departmentDailyActuals[period]?.[depKey] ?? {};
      const target = departmentTargets[period]?.[depKey] ?? fallback.plan;
      const actual = monthActualFromDaily(daily, fallback.result);
      return {
        depKey,
        target,
        actual,
        dailyTarget: Math.round(calculateDailyTarget(target, period)),
        track: Math.round(calculateTrackTarget(target, period, today)),
        remaining: calculateRemaining(target, actual),
        achievement: ratio({ plan: target, result: actual }),
        firstHalf: firstHalfActualFromDaily(daily),
      };
    });
  }, [deps, block, departmentDailyActuals, departmentTargets, period, today]);

  const monthTarget = depStats.reduce((sum, d) => sum + d.target, 0);
  const totalMonthActual = depStats.reduce((sum, d) => sum + d.actual, 0);
  const firstHalfActual = depStats.reduce((sum, d) => sum + d.firstHalf, 0);
  // Second-half increment = current cumulative minus first-half actual
  const secondHalfActual = Math.max(0, totalMonthActual - firstHalfActual);

  const trackTarget = Math.round(calculateTrackTarget(monthTarget, period, today));
  const dailyTarget = Math.round(calculateDailyTarget(monthTarget, period));
  const firstHalfTarget = Math.round(calculateFirstHalfTarget(monthTarget, period));
  const checkpoint80Target = Math.round(calculate80PercentTarget(firstHalfTarget));
  const secondHalfTarget = Math.round(calculateSecondHalfTarget(monthTarget, period));
  const month85Target = Math.round(calculate85PercentTarget(monthTarget));

  const totalRatio = ratio({ plan: monthTarget, result: totalMonthActual });
  const totalTone = toneClass(statusOf(totalRatio).tone);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-1 sm:px-4 fade-in">
      {/* Header */}
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-subtle">Combined performance for {deps.join(" + ")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-subtle">Total Month Achievement</div>
            <div className="font-mono text-lg font-bold text-foreground">
              {formatPct(totalRatio)}
            </div>
          </div>
          <StatusPill ratio={totalRatio} />
        </div>
      </div>

      {/* Department total + Track until yesterday */}
      <SplitPair
        bp="xl"
        left={
          <section className="hairline print-surface gradient-border h-full rounded-2xl bg-card/90 p-5 sm:p-6 card-hover">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xs font-semibold tracking-kicker text-primary uppercase">
                  Department total
                </p>
                <h2 className="mt-0.5 text-xl font-bold text-foreground">{title}</h2>
              </div>
              <StatusPill ratio={totalRatio} />
            </div>
            <MetricBoxes
              items={[
                { label: "Total target", value: formatNumber(monthTarget) },
                { label: "Daily target", value: formatNumber(dailyTarget) },
                { label: "Track", value: formatNumber(trackTarget) },
                { label: "Total actual", value: formatNumber(totalMonthActual), accent: totalTone },
                { label: "Achievement", value: formatPct(totalRatio), accent: totalTone },
              ]}
            />
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs text-subtle">
                <span className="font-medium">Achievement</span>
                <span className="font-semibold text-foreground">{formatPct(totalRatio)}</span>
              </div>
              <ProgressBar value={totalRatio} />
            </div>
          </section>
        }
        right={
          <TrackCard target={trackTarget} actual={totalMonthActual} totalTarget={monthTarget} day={trackDay} />
        }
      />

      {/* Department sections: wide groups get one combined table,
          small groups keep a card per department */}
      {deps.length > 2 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-foreground">{title} breakdown</h3>
              <p className="text-xs text-subtle">All sections combined in one table</p>
            </div>
            <StatusPill ratio={totalRatio} />
          </div>
          <SplitPair
            bp="xl"
            left={
              <section className="hairline print-surface gradient-border h-full rounded-2xl bg-card/90 p-5 sm:p-6 card-hover">
                <div className="overflow-hidden">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border text-2xs uppercase tracking-wider text-subtle">
                        <th className="px-2 py-2 font-semibold">Section</th>
                        <th className="px-2 py-2 text-right font-semibold">Target</th>
                        <th className="px-2 py-2 text-right font-semibold">Actual</th>
                        <th className="px-2 py-2 text-right font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depStats.map((d) => {
                        const r = ratio({ plan: d.target, result: d.actual });
                        return (
                          <tr key={d.depKey} className="border-b border-border/60 last:border-0">
                            <td className="truncate px-2 py-2.5 text-xs font-semibold text-foreground sm:text-sm">
                              {DEP_SHORT[d.depKey]}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-[11px] whitespace-nowrap tabular-nums text-muted sm:text-xs">
                              {formatNumber(d.target)}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums text-foreground sm:text-xs">
                              {formatNumber(d.actual)}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums text-muted sm:text-xs">
                              {formatPct(r)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-border">
                        <td className="px-2 py-2.5 text-xs font-bold text-foreground sm:text-sm">Total</td>
                        <td className="px-2 py-2.5 text-right font-mono text-[11px] font-bold whitespace-nowrap tabular-nums text-foreground sm:text-xs">
                          {formatNumber(monthTarget)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-[11px] font-bold whitespace-nowrap tabular-nums text-foreground sm:text-xs">
                          {formatNumber(totalMonthActual)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-[11px] font-bold whitespace-nowrap tabular-nums text-foreground sm:text-xs">
                          {formatPct(totalRatio)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            }
            right={
              <TrackCard target={trackTarget} actual={totalMonthActual} totalTarget={monthTarget} day={trackDay} />
            }
          />
        </div>
      ) : (
      <div>
        <p className="mb-3 text-2xs font-semibold tracking-kicker text-subtle uppercase">
          Department sections
        </p>
        <div className="flex flex-col gap-6">
          {depStats.map((d) => {
            const copy = DEP_COPY[d.depKey];
            const depTone = toneClass(statusOf(d.achievement).tone);
            return (
              <div key={d.depKey} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-foreground">{copy.title}</h3>
                    <p className="text-xs text-subtle">{copy.blurb}</p>
                  </div>
                  <StatusPill ratio={d.achievement} />
                </div>
                <SplitPair
                  bp="xl"
                  left={
                    <section className="hairline print-surface gradient-border h-full rounded-2xl bg-card/90 p-5 sm:p-6 card-hover">
                      <p className="mb-3 text-2xs font-semibold tracking-kicker text-subtle uppercase">
                        Summary
                      </p>
                      <MetricBoxes
                        items={[
                          { label: "Daily target", value: formatNumber(d.dailyTarget) },
                          { label: "Track", value: formatNumber(d.track) },
                          { label: "MTD actual", value: formatNumber(d.actual), accent: depTone },
                          { label: "Remaining", value: formatNumber(d.remaining) },
                          { label: "Achievement", value: formatPct(d.achievement), accent: depTone },
                        ]}
                      />
                    </section>
                  }
                  right={
                    <TrackCard target={d.track} actual={d.actual} totalTarget={d.target} day={trackDay} />
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* First 15 days + 80% checkpoint */}
      <SplitPair
        bp="md"
        left={
          <HalfCard
            title="First 15 days"
            subtitle="Day 1 to Day 15"
            target={firstHalfTarget}
            actual={firstHalfActual}
          />
        }
        right={
          <HalfCard
            title="First-half 80% checkpoint"
            subtitle="80% of the first 15-day target"
            target={checkpoint80Target}
            actual={firstHalfActual}
          />
        }
      />

      {/* Second half (increment) + Month total at 85% */}
      {visibleSecond && (
        <SplitPair
          bp="md"
          left={
            <HalfCard
              title="Second half"
              subtitle={`Day 16 to Day ${daysInMonth}`}
              target={secondHalfTarget}
              actual={secondHalfActual}
            />
          }
          right={
            <HalfCard
              title="Month total at 85%"
              subtitle="85% of monthly target"
              target={month85Target}
              actual={totalMonthActual}
            />
          }
        />
      )}
    </div>
  );
}
