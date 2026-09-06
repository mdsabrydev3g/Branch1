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
  type Dep,
  type PeriodId,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { StatInput } from "@/components/stat-input";

export function DepartmentView({ dep, compact = false }: { dep: Dep; compact?: boolean }) {
  const block = usePerfStore((s) => s.data[s.period][dep]);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const setDepartmentDailyActual = usePerfStore((s) => s.setDepartmentDailyActual);
  const departmentTarget = usePerfStore((s) => s.departmentTargets[s.period]?.[dep]);
  const setDepartmentTarget = usePerfStore((s) => s.setDepartmentTarget);
  const role = usePerfStore((s) => s.role);
  const today = new Date().toISOString().slice(0, 10);
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
  const tone = statusOf(achievement).tone;
  const copy = DEP_COPY[dep];

  if (compact) {
    return (
      <section className="hairline rounded-2xl border border-border bg-card/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-kicker text-primary uppercase">Section</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">{DEP_SHORT[dep]}</h2>
          </div>
          <StatusPill ratio={achievement} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card-2/70 p-3">
            <StatInput
              label="Monthly Target"
              value={monthlyTarget}
              onChange={(value) => setDepartmentTarget(dep, value)}
              disabled={role === "staff"}
            />
          </div>
          <div className="rounded-xl border border-border bg-card-2/70 p-3">
            <StatInput
              label="Today's Actual"
              value={dailyActual}
              onChange={(value) => setDepartmentDailyActual(dep, today, value)}
              disabled={role === "staff"}
            />
          </div>
          <SummaryCard label="Track" value={formatNumber(trackTarget)} />
          <SummaryCard label="MTD actual" value={formatNumber(monthlyActual)} />
          <SummaryCard label="Achievement" value={formatPct(achievement)} />
        </div>
        <TrackCard
          target={trackTarget}
          actual={trackActual}
          firstHalfTarget={firstHalfTarget}
          day={trackDay}
        />
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-kicker text-primary uppercase">
            Desk
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h1>
          <p className="text-sm text-muted">{copy.blurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="Index" value={formatPct(achievement)} />
          <Chip label="Open" value={formatNumber(calculateRemaining(monthlyTarget, monthlyActual))} />
          <StatusPill ratio={achievement} />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hairline print-surface rounded-2xl border-l-4 border-primary bg-card/90 p-4 shadow-sm">
          <StatInput
            label="Monthly Target"
            value={monthlyTarget}
            onChange={(value) => setDepartmentTarget(dep, value)}
            disabled={role === "staff"}
          />
        </div>
        <div className="hairline print-surface rounded-2xl border-l-4 border-primary bg-card/90 p-4 shadow-sm">
          <StatInput
            label="Today's Actual"
            value={dailyActual}
            onChange={(value) => setDepartmentDailyActual(dep, today, value)}
            disabled={role === "staff"}
          />
          <div className="mt-2 text-xs text-subtle">
            MTD actual from daily sales:{" "}
            <span className="font-mono text-foreground">{formatNumber(monthlyActual)}</span>
          </div>
        </div>
        <SummaryCard label="Track" value={formatNumber(trackTarget)} />
        <SummaryCard label="Remaining" value={formatNumber(calculateRemaining(monthlyTarget, monthlyActual))} />
      </div>
      <div className="hairline print-surface rounded-2xl bg-card/90 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-wide text-subtle uppercase">Department achievement</div>
            <div className={`mt-1 font-mono text-3xl font-medium tabular-nums tracking-tight ${tone === "good" ? "text-success" : tone === "watch" ? "text-warning" : "text-danger"}`}>
              {formatPct(achievement)}
            </div>
          </div>
          <StatusPill ratio={achievement} />
        </div>
        <ProgressBar value={achievement} className="mt-4" />
        <p className="mt-3 text-xs text-muted">
          Department summary only. Branch KPIs are available from Overview and Reports.
        </p>
      </div>
      <TrackCard
        target={trackTarget}
        actual={trackActual}
        firstHalfTarget={firstHalfTarget}
        day={trackDay}
      />
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
        <HalfCard
          title="Month total at 85%"
          target={calculate85PercentTarget(monthlyTarget)}
          actual={monthlyActual}
          subtitle="85% of monthly target"
        />
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
  const today = new Date().toISOString().slice(0, 10);
  const summary = deps.reduce(
    (total, dep) => {
      const fallback = sumBlock(data[period][dep]);
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
  const numberClass =
    tone === "good"
      ? "text-success"
      : tone === "watch"
        ? "text-warning"
        : "text-danger";

  return (
    <div className="flex flex-col gap-5">
      <section className="hairline rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-kicker text-primary uppercase">Department total</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 truncate whitespace-nowrap text-sm text-muted">Target, daily target and actual across all sections.</p>
          </div>
          <StatusPill ratio={achievement} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Total target" value={formatNumber(summary.target)} />
          <SummaryCard
            label="Daily target"
            value={formatNumber(Math.round(calculateDailyTarget(summary.target, period)))}
          />
          <SummaryCard label="Track" value={formatNumber(trackTarget)} />
          <SummaryCard label="Total actual" value={formatNumber(summary.actual)} valueClass={numberClass} />
          <SummaryCard label="Achievement" value={formatPct(achievement)} valueClass={numberClass} />
        </div>
        <ProgressBar value={achievement} className="mt-4" />
      </section>
      <TrackCard
        target={trackTarget}
        actual={trackActual}
        firstHalfTarget={firstHalfTarget}
        day={trackDay}
      />
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
        <HalfCard
          title="Month total at 85%"
          target={calculate85PercentTarget(summary.target)}
          actual={summary.actual}
          subtitle="85% of monthly target"
        />
      </section>
      )}
      <div className="border-l-2 border-border pl-3 sm:pl-5">
        <p className="mb-3 text-xs font-semibold tracking-kicker text-subtle uppercase">Department sections</p>
        <div className="flex flex-col gap-6">
          {deps.map((dep) => (
            <DepartmentView key={dep} dep={dep} compact={title === "Mobile"} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, valueClass = "text-foreground" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="hairline print-surface rounded-2xl bg-card/80 p-4">
      <div className="text-xs tracking-wide text-subtle uppercase">{label}</div>
      <div className={`mt-2 font-mono text-xl font-medium tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function TrackCard({
  target,
  actual,
  firstHalfTarget,
  day,
}: {
  target: number;
  actual: number;
  firstHalfTarget: number;
  day: number;
}) {
  const variance = actual - target;
  const tone = variance > 0 ? "good" : variance < 0 ? "bad" : "watch";
  const toneClass =
    tone === "good" ? "border-success/50 bg-success/10 text-success" :
    tone === "watch" ? "border-warning/50 bg-warning/10 text-warning" :
    "border-danger/50 bg-danger/10 text-danger";
  const stateLabel =
    tone === "good" ? "Ahead of track" :
    tone === "bad" ? "Behind track" :
    "On track";

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-wide uppercase">Track until yesterday</div>
          <div className="mt-1 text-xs opacity-80">
            Track target through day {day}; rate = cumulative actual through yesterday minus target
          </div>
        </div>
        <span className="rounded-full bg-current/10 px-2 py-1 text-xs font-semibold">
          {stateLabel}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TrackMetric
          label="Track Target"
          amount={target}
          percentage={firstHalfTarget > 0 ? target / firstHalfTarget : 0}
        />
        <TrackMetric
          label="Actual Through Yesterday"
          amount={actual}
          percentage={target > 0 ? actual / target : 0}
        />
        <TrackMetric
          label="Track Rate"
          amount={variance}
          percentage={target > 0 ? variance / target : 0}
          signed
          valueClass={tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : "text-warning"}
        />
      </div>
    </div>
  );
}

function TrackMetric({
  label,
  amount,
  percentage,
  signed = false,
  valueClass = "text-foreground",
}: {
  label: string;
  amount: number;
  percentage: number;
  signed?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-current/15 bg-card/30 p-3">
      <div className="text-xs opacity-75">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${valueClass}`}>
        {signed && amount > 0 ? "+" : ""}{formatNumber(amount)}
      </div>
      <div className="mt-1 text-xs font-semibold">{formatPct(percentage)}</div>
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
    <article className="hairline print-surface rounded-2xl bg-card/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-subtle">{subtitle}</p>
        </div>
        <StatusPill ratio={achievement} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <SummaryCard label="Target" value={formatNumber(target)} />
        <SummaryCard label="Actual" value={formatNumber(actual)} />
        <SummaryCard label="Remaining" value={formatNumber(calculateRemaining(target, actual))} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>Achievement</span>
        <span className="font-mono font-semibold text-foreground">{formatPct(achievement)}</span>
      </div>
      <ProgressBar value={achievement} className="mt-2" />
    </article>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-2xs tracking-wide text-subtle uppercase">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums text-foreground">{value}</div>
    </div>
  );
}
