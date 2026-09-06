import {
  DEP_COPY,
  DEP_SHORT,
  formatNumber,
  formatPct,
  calculateDailyTarget,
  calculateFirstHalfTarget,
  calculateSecondHalfTarget,
  calculate80PercentTarget,
  calculate85PercentTarget,
  calculateRemaining,
  cumulativeThroughDate,
  departmentFirstHalfActual,
  departmentMonthActual,
  departmentSecondHalfActual,
  getDaysInMonth,
  getTrackDay,
  isSecondHalfVisible,
  ratio,
  sumBlock,
  statusOf,
  todayISO,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { StatInput } from "@/components/stat-input";
import { cn } from "@/lib/utils";

type Metric = { label: string; value: string; valueClass?: string };

function MetricStrip({
  items,
  className,
  columns = 3,
}: {
  items: Metric[];
  className?: string;
  columns?: 3 | 5;
}) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border bg-border",
        columns === 5
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : "grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-card px-2 py-3 text-center">
          <div className="truncate text-2xs font-medium tracking-wide text-subtle uppercase">
            {item.label}
          </div>
          <div
            className={cn(
              "mt-1 truncate font-mono text-sm font-semibold tabular-nums sm:text-base",
              item.valueClass ?? "text-foreground",
            )}
          >
            {item.value}
          </div>
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

export function DepartmentView({ dep, compact = false }: { dep: Dep; compact?: boolean }) {
  const block = usePerfStore((s) => s.data[s.period]?.[dep]);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const setDepartmentDailyActual = usePerfStore((s) => s.setDepartmentDailyActual);
  const departmentTarget = usePerfStore((s) => s.departmentTargets[s.period]?.[dep]);
  const setDepartmentTarget = usePerfStore((s) => s.setDepartmentTarget);
  const role = usePerfStore((s) => s.role);
  const today = todayISO();
  const daily = departmentDailyActuals[period]?.[dep] ?? {};
  const dailyActual = daily[today] ?? 0;
  const totals = sumBlock(block);
  const monthlyTarget = departmentTarget ?? totals.plan;
  const monthlyActual = departmentMonthActual(daily, totals.result);
  const firstHalfActual = departmentFirstHalfActual(daily);
  const secondHalfActual = departmentSecondHalfActual(daily);
  const firstHalfTarget = calculateFirstHalfTarget(monthlyTarget, period);
  const secondHalfTarget = calculateSecondHalfTarget(monthlyTarget, period);
  const achievement = ratio({ plan: monthlyTarget, result: monthlyActual });
  const trackDay = getTrackDay(period, today);
  const trackTarget = Math.round(calculateDailyTarget(monthlyTarget, period) * trackDay);
  const trackActual = cumulativeThroughDate(daily, today);
  const showSecondHalf = isSecondHalfVisible(period, today);
  const copy = DEP_COPY[dep];

  if (compact) {
    return (
      <section className="hairline rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-semibold tracking-kicker text-primary uppercase">Section</p>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">{DEP_SHORT[dep]}</h2>
          </div>
          <StatusPill ratio={achievement} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card-2/50 p-3">
            <StatInput
              label="Monthly Target"
              value={monthlyTarget}
              onChange={(value) => setDepartmentTarget(dep, value)}
              disabled={role === "staff"}
            />
          </div>
          <div className="rounded-xl border border-border bg-card-2/50 p-3">
            <StatInput
              label="Today's Actual"
              value={dailyActual}
              onChange={(value) => setDepartmentDailyActual(dep, today, value)}
              disabled={role === "staff"}
            />
          </div>
        </div>
        <MetricStrip
          className="mt-3"
          items={[
            { label: "Track", value: formatNumber(trackTarget) },
            { label: "MTD actual", value: formatNumber(monthlyActual) },
            { label: "Achievement", value: formatPct(achievement), valueClass: toneClass(statusOf(achievement).tone) },
          ]}
        />
        <TrackCard target={trackTarget} actual={trackActual} day={trackDay} />
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-2xs font-semibold tracking-kicker text-primary uppercase">Desk</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h1>
          <p className="text-sm text-muted">{copy.blurb}</p>
        </div>
        <StatusPill ratio={achievement} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="hairline rounded-2xl border border-border bg-card p-4 shadow-sm">
          <StatInput
            label="Monthly Target"
            value={monthlyTarget}
            onChange={(value) => setDepartmentTarget(dep, value)}
            disabled={role === "staff"}
          />
        </div>
        <div className="hairline rounded-2xl border border-border bg-card p-4 shadow-sm">
          <StatInput
            label="Today's Actual"
            value={dailyActual}
            onChange={(value) => setDepartmentDailyActual(dep, today, value)}
            disabled={role === "staff"}
          />
        </div>
      </div>

      <MetricStrip
        columns={5}
        items={[
          { label: "Daily target", value: formatNumber(Math.round(calculateDailyTarget(monthlyTarget, period))) },
          { label: "Track", value: formatNumber(trackTarget) },
          { label: "MTD actual", value: formatNumber(monthlyActual) },
          { label: "Remaining", value: formatNumber(calculateRemaining(monthlyTarget, monthlyActual)) },
          { label: "Achievement", value: formatPct(achievement), valueClass: toneClass(statusOf(achievement).tone) },
        ]}
      />

      <TrackCard target={trackTarget} actual={trackActual} day={trackDay} />

      <section className="grid gap-4 sm:grid-cols-2">
        <HalfCard
          title="First 15 days"
          target={firstHalfTarget}
          actual={firstHalfActual}
          subtitle="Day 1 to Day 15"
        />
        <HalfCard
          title="First-half 80% checkpoint"
          target={calculate80PercentTarget(firstHalfTarget)}
          actual={firstHalfActual}
          subtitle="80% of the first 15-day target"
        />
        {showSecondHalf && (
          <HalfCard
            title="Second half"
            target={secondHalfTarget}
            actual={secondHalfActual}
            subtitle={`Day 16 to Day ${getDaysInMonth(period)}`}
          />
        )}
        {showSecondHalf && (
          <HalfCard
            title="Month total at 85%"
            target={calculate85PercentTarget(monthlyTarget)}
            actual={monthlyActual}
            subtitle="85% of monthly target"
          />
        )}
      </section>
    </div>
  );
}

export function DepartmentGroupView({
  title,
  deps,
}: {
  title: string;
  deps: Dep[];
}) {
  const period = usePerfStore((s) => s.period);
  const data = usePerfStore((s) => s.data);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const today = todayISO();
  const summary = deps.reduce(
    (total, dep) => {
      const fallback = sumBlock(data[period]?.[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      return {
        target: total.target + (departmentTargets[period]?.[dep] ?? fallback.plan),
        actual: total.actual + departmentMonthActual(daily, fallback.result),
      };
    },
    { target: 0, actual: 0 },
  );
  const achievement = ratio({ plan: summary.target, result: summary.actual });
  const firstHalfActual = deps.reduce(
    (total, dep) =>
      total +
      departmentFirstHalfActual(departmentDailyActuals[period]?.[dep] ?? {}),
    0,
  );
  const secondHalfActual = deps.reduce(
    (total, dep) =>
      total +
      departmentSecondHalfActual(departmentDailyActuals[period]?.[dep] ?? {}),
    0,
  );
  const firstHalfTarget = calculateFirstHalfTarget(summary.target, period);
  const secondHalfTarget = calculateSecondHalfTarget(summary.target, period);
  const trackDay = getTrackDay(period, today);
  const trackTarget = Math.round(calculateDailyTarget(summary.target, period) * trackDay);
  const trackActual = deps.reduce(
    (total, dep) =>
      total +
      cumulativeThroughDate(departmentDailyActuals[period]?.[dep] ?? {}, today),
    0,
  );
  const showSecondHalf = isSecondHalfVisible(period, today);
  const tone = statusOf(achievement).tone;

  return (
    <div className="flex flex-col gap-5">
      <section className="hairline rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-2xs font-semibold tracking-kicker text-primary uppercase">Department total</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          </div>
          <StatusPill ratio={achievement} />
        </div>
        <MetricStrip
          className="mt-4"
          columns={5}
          items={[
            { label: "Total target", value: formatNumber(summary.target) },
            { label: "Daily target", value: formatNumber(Math.round(calculateDailyTarget(summary.target, period))) },
            { label: "Track", value: formatNumber(trackTarget) },
            { label: "Total actual", value: formatNumber(summary.actual), valueClass: toneClass(tone) },
            { label: "Achievement", value: formatPct(achievement), valueClass: toneClass(tone) },
          ]}
        />
        <ProgressBar value={achievement} className="mt-4" />
      </section>

      <TrackCard target={trackTarget} actual={trackActual} day={trackDay} />

      {title === "Mobile" && (
        <section className="grid gap-4 sm:grid-cols-2">
          <HalfCard title="First 15 days" target={firstHalfTarget} actual={firstHalfActual} subtitle="Day 1 to Day 15" />
          <HalfCard
            title="First-half 80% checkpoint"
            target={calculate80PercentTarget(firstHalfTarget)}
            actual={firstHalfActual}
            subtitle="80% of the first 15-day target"
          />
          {showSecondHalf && (
            <HalfCard
              title="Second half"
              target={secondHalfTarget}
              actual={secondHalfActual}
              subtitle={`Day 16 to Day ${getDaysInMonth(period)}`}
            />
          )}
          {showSecondHalf && (
            <HalfCard
              title="Month total at 85%"
              target={calculate85PercentTarget(summary.target)}
              actual={summary.actual}
              subtitle="85% of monthly target"
            />
          )}
        </section>
      )}

      <div>
        <p className="mb-3 text-2xs font-semibold tracking-kicker text-subtle uppercase">Department sections</p>
        <div className="flex flex-col gap-5">
          {deps.map((dep) => (
            <DepartmentView key={dep} dep={dep} compact={title === "Mobile"} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackCard({
  target,
  actual,
  day,
}: {
  target: number;
  actual: number;
  day: number;
}) {
  const variance = actual - target;
  const tone = variance > 0 ? "good" : variance < 0 ? "bad" : "watch";
  const wrapClass =
    tone === "good" ? "border-success/40 bg-success/5" :
    tone === "watch" ? "border-warning/40 bg-warning/5" :
    "border-danger/40 bg-danger/5";
  const stateLabel =
    tone === "good" ? "Ahead of track" :
    tone === "bad" ? "Behind track" :
    "On track";

  return (
    <div className={cn("rounded-2xl border p-4", wrapClass)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-2xs font-semibold tracking-wide text-foreground uppercase">Track until yesterday</div>
          <div className="mt-0.5 text-xs text-muted">
            Cumulative target through day {day}
          </div>
        </div>
        <span className={cn("rounded-full border border-current/30 px-2.5 py-0.5 text-2xs font-semibold", toneClass(tone))}>
          {stateLabel}
        </span>
      </div>
      <MetricStrip
        className="mt-3"
        items={[
          { label: "Track target", value: formatNumber(target) },
          { label: "Actual through yesterday", value: formatNumber(actual) },
          {
            label: "Variance",
            value: `${variance > 0 ? "+" : ""}${formatNumber(variance)}`,
            valueClass: toneClass(tone),
          },
        ]}
      />
    </div>
  );
}

function HalfCard({
  title,
  target,
  actual,
  subtitle,
}: {
  title: string;
  target: number;
  actual: number;
  subtitle: string;
}) {
  const achievement = ratio({ plan: target, result: actual });
  return (
    <article className="hairline rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>
        </div>
        <StatusPill ratio={achievement} />
      </div>
      <MetricStrip
        className="mt-3"
        items={[
          { label: "Target", value: formatNumber(target) },
          { label: "Actual", value: formatNumber(actual) },
          { label: "Remaining", value: formatNumber(calculateRemaining(target, actual)) },
        ]}
      />
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>Achievement</span>
        <span className="font-mono font-semibold text-foreground">{formatPct(achievement)}</span>
      </div>
      <ProgressBar value={achievement} className="mt-2" />
    </article>
  );
}
