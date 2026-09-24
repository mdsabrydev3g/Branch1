import { useMemo } from "react";
import { FileDown, Printer } from "lucide-react";
import {
  DEPS,
  DEP_COPY,
  calculate85PercentTarget,
  calculateFirstHalfTarget,
  calculateRemaining,
  calculateSecondHalfTarget,
  calculateTrackTarget,
  cumAtDay,
  firstHalfOverrideFor,
  fitDenseTextClass,
  fitSmallTextClass,
  fitTextClass,
  formatNumber,
  formatPct,
  getDaysInMonth,
  getTrackDay,
  latestDailyValue,
  firstHalfActualFromDaily,
  KPIS,
  periodMeta,
  ratio,
  statusOf,
  sumBlock,
  SALES_GROUPS,
  type PeriodBlock,
  type DepartmentDailyActuals,
  type DepartmentTargets,
  type BranchKpiDataByPeriod,
  type BranchDailyActuals,
  type PeriodId,
  type StatusTone,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";

const TONE_TEXT: Record<StatusTone, string> = {
  good: "text-success",
  watch: "text-warning",
  bad: "text-danger",
};

export function ReportsView() {
  const period = usePerfStore((s) => s.period);
  const block = usePerfStore((s) => s.data[period]);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const branchKpisByPeriod = usePerfStore((s) => s.branchKpisByPeriod);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const meta = periodMeta(period);
  // مثل صفحة Overview: نسبة الفرع = المحقق التراكمي ÷ التراك (مستهدف حتى الأمس)
  const totals = DEPS.reduce(
    (total, dep) => {
      const fallback = sumBlock(block[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      const depActual =
        Object.keys(daily).length > 0 ? cumAtDay(daily, getTrackDay(period)) : fallback.result;
      const depTarget = departmentTargets[period]?.[dep] ?? fallback.plan;
      return {
        plan: total.plan + depTarget,
        track: total.track + calculateTrackTarget(depTarget, period),
        result: total.result + depActual,
      };
    },
    { plan: 0, track: 0, result: 0 },
  );
  const branchRatio = ratio({ plan: totals.track, result: totals.result });
  const branchStatus = statusOf(branchRatio);

  // محقق النصف الأول (أول 15 يوم) للفرع: قيم الإدارة الثابتة لكل مجموعة عند
  // توفرها، وإلا يُحسب من آخر قراءة يومية داخل أول 15 يوم
  const groupOverrides = SALES_GROUPS.map((g) =>
    firstHalfOverrideFor(period, g.id),
  );
  const allGroupsOverridden =
    groupOverrides.length > 0 && groupOverrides.every((v) => typeof v === "number");
  const branchFirstHalfActual = allGroupsOverridden
    ? groupOverrides.reduce<number>((sum, v) => sum + (v ?? 0), 0)
    : DEPS.reduce((sum, dep) => {
        const fallback = sumBlock(block[dep]);
        const daily = departmentDailyActuals[period]?.[dep] ?? {};
        const hasDaily = Object.keys(daily).length > 0;
        const depMonthActual = hasDaily ? cumAtDay(daily, getDaysInMonth(period)) : fallback.result;
        const depFirstHalf = hasDaily
          ? cumAtDay(daily, 15)
          : Math.min(depMonthActual, Math.round(depMonthActual * 0.5));
        return sum + depFirstHalf;
      }, 0);
  // النصف الثاني = المحقق التراكمي الحالي − محقق النصف الأول
  const branchSecondHalfActual = Math.max(0, totals.result - branchFirstHalfActual);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-kicker text-primary uppercase">
            Management reporting
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Performance report
          </h1>
          <p className="text-sm text-muted">
            {meta.label} · Fayoum 1 scorecard for desk reviews.
          </p>
        </div>
        <div className="flex gap-2 print-hidden">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                meta.label,
                block,
                period,
                departmentTargets,
                departmentDailyActuals,
                branchKpisByPeriod,
                branchDailyActuals,
              )
            }
          >
            <FileDown />
            CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Plan" value={formatNumber(totals.plan)} />
        <Summary label="Result" value={formatNumber(totals.result)} />
        <Summary label="Index" value={formatPct(branchRatio)} />
        <Summary
          label="Status"
          value={branchStatus.report}
          tone={branchStatus.tone}
        />
      </section>

      <section className="hairline print-surface rounded-2xl bg-card/80 p-4 sm:p-5">
        <div className="mb-3 border-b border-border pb-3">
          <h2 className="text-sm font-medium text-foreground">Target progress</h2>
          <p className="mt-1 text-xs text-subtle">Automatic first-half and second-half tracking</p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HalfSummary
            label="First half"
            target={calculateFirstHalfTarget(totals.plan, period)}
            actual={branchFirstHalfActual}
          />
          <HalfSummary
            label="Second half"
            target={calculateSecondHalfTarget(totals.plan, period)}
            actual={branchSecondHalfActual}
          />
          <HalfSummary
            label="85%"
            target={calculate85PercentTarget(totals.plan)}
            actual={totals.result}
          />
        </div>
      </section>

      <section className="space-y-4">
        {SALES_GROUPS.map((group) => (
          <div key={group.id} className="space-y-3">
            <ReportUnitCard
              title={group.title}
              deps={group.deps}
              period={period}
              block={block}
              departmentTargets={departmentTargets}
              departmentDailyActuals={departmentDailyActuals}
              highlight
            />
            <div className="grid gap-4 md:grid-cols-2">
              {group.deps.map((dep) => (
                <ReportUnitCard
                  key={dep}
                  title={DEP_COPY[dep].title}
                  deps={[dep]}
                  period={period}
                  block={block}
                  departmentTargets={departmentTargets}
                  departmentDailyActuals={departmentDailyActuals}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="hairline print-surface rounded-2xl bg-card/80 p-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-medium text-foreground">
            Branch KPIs
          </h2>
          <p className="text-xs text-subtle">Every branch KPI in its own printable card</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KPIS.map((kpi) => {
            // Branch KPI Actual is driven by the corresponding Daily KPI reading.
            // Use the latest saved cumulative reading, including today's entry.
            const enteredPlan = branchKpisByPeriod[period]?.[kpi]?.plan ?? 0;
            const dailyKpi = branchDailyActuals[period]?.[kpi] ?? {};
            const enteredActual = latestDailyValue(dailyKpi);
            const isGross = kpi === "Gross";
            const target = isGross && enteredPlan === 0 ? totals.plan : enteredPlan;
            const actual = enteredActual;
            const r = ratio({ plan: target, result: actual });
            return (
              <article key={kpi} className="rounded-xl border border-border bg-card-2/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">{kpi}</h3>
                  <div className="flex items-center gap-2">
                    <span className={cn("shrink-0 font-mono text-xs font-semibold", TONE_TEXT[statusOf(r).tone])}>
                      {formatPct(r)}
                    </span>
                    <StatusPill ratio={r} report />
                  </div>
                </div>
                <div className="mt-2 grid min-w-0 grid-cols-3 gap-1.5">
                  <ProgressMetric label="Target" value={formatNumber(target)} />
                  <ProgressMetric label="Actual" value={formatNumber(actual)} />
                  <ProgressMetric label="Remaining" value={formatNumber(calculateRemaining(target, actual))} />
                </div>
                <div className="mt-2.5">
                  <ProgressBar value={r} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ReportUnitCard({
  title,
  deps,
  period,
  block,
  departmentTargets,
  departmentDailyActuals,
  highlight = false,
}: {
  title: string;
  deps: typeof DEPS[number][];
  period: PeriodId;
  block: PeriodBlock;
  departmentTargets: DepartmentTargets;
  departmentDailyActuals: DepartmentDailyActuals;
  highlight?: boolean;
}) {
  const target = deps.reduce((sum, dep) => {
    const fallback = sumBlock(block[dep]);
    return sum + (departmentTargets[period]?.[dep] ?? fallback.plan);
  }, 0);

  const daily = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const dep of deps) {
      const source = departmentDailyActuals[period]?.[dep] ?? {};
      for (const [date, value] of Object.entries(source)) {
        merged[date] = (merged[date] || 0) + (Number(value) || 0);
      }
    }
    return merged;
  }, [deps, departmentDailyActuals, period]);

  const actual = Object.keys(daily).length
    ? cumAtDay(daily, getTrackDay(period))
    : deps.reduce((sum, dep) => sum + sumBlock(block[dep]).result, 0);
  const track = calculateTrackTarget(target, period);
  const r = ratio({ plan: track, result: actual });
  const half1 = Object.keys(daily).length
    ? firstHalfActualFromDaily(daily)
    : 0;

  return (
    <section className={cn(
      "hairline print-surface rounded-2xl bg-card/80 p-4",
      highlight && "border-primary/30 ring-1 ring-primary/20"
    )}>
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {highlight && <p className="mt-0.5 text-xs text-subtle">Combined total</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-sm font-semibold tabular-nums", TONE_TEXT[statusOf(r).tone])}>
            {formatPct(r)}
          </span>
          <StatusPill ratio={r} report />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Summary label="Target" value={formatNumber(target)} />
        <Summary label="Track" value={formatNumber(track)} />
        <Summary label="Actual" value={formatNumber(actual)} />
        <Summary label="Remaining" value={formatNumber(calculateRemaining(target, actual))} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Summary label="Half1" value={formatNumber(half1)} />
        <Summary label="Daily Target" value={formatNumber(target / getDaysInMonth(period))} />
      </div>
      <div className="mt-3">
        <ProgressBar value={r} />
        <div className="mt-1 flex justify-between text-xs text-subtle">
          <span>Actual / Track</span>
          <span className={cn("font-mono font-semibold", TONE_TEXT[statusOf(r).tone])}>{formatPct(r)}</span>
        </div>
      </div>
    </section>
  );
}

function HalfSummary({
  label,
  target,
  actual,
}: {
  label: string;
  target: number;
  actual: number;
}) {
  const r = ratio({ plan: target, result: actual });
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card-2/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-xs font-medium text-foreground">{label}</div>
        <div className={cn("shrink-0 font-mono text-xs font-semibold", TONE_TEXT[statusOf(r).tone])}>
          {formatPct(r)}
        </div>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-3 gap-1.5">
        <ProgressMetric label="Target" value={formatNumber(target)} />
        <ProgressMetric label="Actual" value={formatNumber(actual)} />
        <ProgressMetric label="Remaining" value={formatNumber(calculateRemaining(target, actual))} />
      </div>
      <div className="mt-2.5">
        <ProgressBar value={r} />
      </div>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/80 bg-card/80 px-1.5 py-2 text-center">
      <div className="truncate text-2xs tracking-wide text-subtle uppercase">{label}</div>
      <div
        className={cn(
          "mt-1 truncate font-mono font-medium tabular-nums text-foreground",
          fitSmallTextClass(value),
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
  dense,
}: {
  label: string;
  value: string;
  tone?: StatusTone;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "hairline print-surface min-w-0 rounded-2xl bg-card/80 py-3",
        dense ? "px-2" : "px-3",
      )}
    >
      <div className="truncate text-2xs tracking-wide text-subtle uppercase">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 truncate font-mono tabular-nums",
          tone ? TONE_TEXT[tone] : "text-foreground",
          dense ? fitDenseTextClass(value) : fitTextClass(value),
        )}
      >
        {value}
      </div>
    </div>
  );
}

function downloadCsv(
  label: string,
  block: PeriodBlock,
  period: PeriodId,
  departmentTargets: DepartmentTargets,
  departmentDailyActuals: DepartmentDailyActuals,
  branchKpisByPeriod: BranchKpiDataByPeriod,
  branchDailyActuals: BranchDailyActuals,
) {
  const lines = [["Section", "Measure", "Target", "Actual", "Progress", "Status"]];
  let branchPlanSum = 0;
  let branchActualSum = 0;
  for (const dep of DEPS) {
    const fallback = sumBlock(block[dep]);
    const target = departmentTargets[period]?.[dep] ?? fallback.plan;
    const daily = departmentDailyActuals[period]?.[dep] ?? {};
    const actual =
      Object.keys(daily).length > 0 ? cumAtDay(daily, getTrackDay(period)) : fallback.result;
    const departmentRatio = ratio({ plan: target, result: actual });
    branchPlanSum += target;
    branchActualSum += actual;
    lines.push([dep, "Department total", String(target), String(actual), formatPct(departmentRatio), statusText(departmentRatio)]);
  }
  for (const kpi of KPIS) {
    const isGross = kpi === "Gross";
    const enteredPlan = branchKpisByPeriod[period]?.[kpi]?.plan ?? 0;
    // Branch KPI Actual is driven by the corresponding Daily KPI reading.
    const dailyKpi = branchDailyActuals[period]?.[kpi] ?? {};
    const enteredActual = latestDailyValue(dailyKpi);
    const target = isGross && enteredPlan === 0 ? branchPlanSum : enteredPlan;
    const actual = enteredActual;
    const kpiRatio = ratio({ plan: target, result: actual });
    lines.push(["Branch KPIs", kpi, String(target), String(actual), formatPct(kpiRatio), statusText(kpiRatio)]);
  }
  const csv = "\uFEFF" + lines.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fayoum-1-${label.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function statusText(value: number): string {
  if (value >= 1) return "Good";
  if (value >= 0.8) return "Will Do";
  return "Danger";
}
