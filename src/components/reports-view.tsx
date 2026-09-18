import { FileDown, Printer } from "lucide-react";
import {
  DEPS,
  DEP_COPY,
  calculate80PercentTarget,
  calculate85PercentTarget,
  calculateFirstHalfTarget,
  calculateRemaining,
  calculateSecondHalfTarget,
  calculateTrackTarget,
  firstHalfActualFromDaily,
  firstHalfOverrideFor,
  fitDenseTextClass,
  fitSmallTextClass,
  fitTextClass,
  formatNumber,
  formatPct,
  latestDailyValue,
  KPIS,
  periodMeta,
  ratio,
  statusOf,
  sumBlock,
  SALES_GROUPS,
  type PeriodBlock,
  type DepartmentDailyActuals,
  type DepartmentTargets,
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
  const branchKpis = usePerfStore((s) => s.branchKpis);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const meta = periodMeta(period);
  // مثل صفحة Overview: نسبة الفرع = المحقق التراكمي ÷ التراك (مستهدف حتى الأمس)
  const totals = DEPS.reduce(
    (total, dep) => {
      const fallback = sumBlock(block[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      const latestVal = latestDailyValue(daily);
      const depActual = latestVal > 0 ? latestVal : (Object.keys(daily).length > 0 ? latestVal : fallback.result);
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
        const latestVal = latestDailyValue(daily);
        const hasDaily = Object.keys(daily).length > 0;
        const depMonthActual = hasDaily ? latestVal : fallback.result;
        const depFirstHalf = hasDaily
          ? firstHalfActualFromDaily(daily)
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
                branchKpis,
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
          <p className="mt-1 text-xs text-subtle">Automatic first-half, second-half and milestone tracking</p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            label="80% milestone"
            target={calculate80PercentTarget(totals.plan)}
            actual={branchFirstHalfActual}
          />
          <HalfSummary
            label="85% milestone"
            target={calculate85PercentTarget(totals.plan)}
            actual={branchFirstHalfActual}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
      {DEPS.map((dep) => {
        const desk = sumBlock(block[dep]);
        const daily = departmentDailyActuals[period]?.[dep] ?? {};
        const deskTarget = departmentTargets[period]?.[dep] ?? desk.plan;
        const latestVal = latestDailyValue(daily);
        const deskActual = latestVal > 0 ? latestVal : (Object.keys(daily).length > 0 ? latestVal : desk.result);
        const track = calculateTrackTarget(deskTarget, period);
        const trackRatio = ratio({ plan: track, result: deskActual });
        return (
          <section
            key={dep}
            className="hairline print-surface rounded-2xl bg-card/80 p-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">
                  {DEP_COPY[dep].title}
                </h2>
                <p className="text-xs text-subtle">{DEP_COPY[dep].blurb}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm tabular-nums text-muted">
                  {formatPct(trackRatio)}
                </span>
                <StatusPill ratio={trackRatio} report />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary label="Target" value={formatNumber(deskTarget)} />
              <Summary label="Track" value={formatNumber(track)} />
              <Summary label="Actual" value={formatNumber(deskActual)} />
              <Summary label="Remaining" value={formatNumber(calculateRemaining(deskTarget, deskActual))} />
            </div>
            <div className="mt-3">
              <ProgressBar value={trackRatio} />
              <div className="mt-1 flex justify-between text-xs text-subtle">
                <span>Actual / Track</span>
                <span className="font-mono">{formatPct(trackRatio)}</span>
              </div>
            </div>
          </section>
        );
      })}
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
            const entry = branchKpis[kpi];
            const actual = Object.values(branchDailyActuals[period]?.[kpi] ?? {}).reduce(
              (sum, value) => sum + value,
              0,
            );
            const r = ratio({ plan: entry.plan, result: actual });
            return (
              <article key={kpi} className="rounded-xl border border-border bg-card-2/70 p-3">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <h3 className="text-sm font-medium text-foreground">{kpi}</h3>
                  <StatusPill ratio={r} report />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Summary dense label="Target" value={formatNumber(entry.plan)} />
                  <Summary dense label="Actual" value={formatNumber(actual)} />
                  <Summary dense label="Remaining" value={formatNumber(calculateRemaining(entry.plan, actual))} />
                </div>
                <div className="mt-3">
                  <ProgressBar value={r} />
                  <div className="mt-1 text-right font-mono text-xs text-muted">{formatPct(r)}</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
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
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card-2/70 p-3">
      <div className="truncate text-xs font-medium text-foreground">{label}</div>
      <div className="mt-2 grid min-w-0 grid-cols-3 gap-1.5">
        <ProgressMetric label="Target" value={formatNumber(target)} />
        <ProgressMetric label="Actual" value={formatNumber(actual)} />
        <ProgressMetric label="Remaining" value={formatNumber(calculateRemaining(target, actual))} />
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
  branchKpis: Record<string, { plan: number; result: number }>,
  branchDailyActuals: BranchDailyActuals,
) {
  const lines = [["Section", "Measure", "Target", "Actual", "Progress", "Status"]];
  for (const dep of DEPS) {
    const fallback = sumBlock(block[dep]);
    const target = departmentTargets[period]?.[dep] ?? fallback.plan;
    const daily = departmentDailyActuals[period]?.[dep] ?? {};
    const latestVal = latestDailyValue(daily);
    const actual = latestVal > 0 ? latestVal : (Object.keys(daily).length > 0 ? latestVal : fallback.result);
    const departmentRatio = ratio({ plan: target, result: actual });
    lines.push([dep, "Department total", String(target), String(actual), formatPct(departmentRatio), statusText(departmentRatio)]);
  }
  for (const kpi of KPIS) {
    const target = branchKpis[kpi]?.plan ?? 0;
    const latestKpiVal = latestDailyValue(branchDailyActuals[period]?.[kpi]);
    const actual = latestKpiVal > 0 ? latestKpiVal : (branchKpis[kpi]?.result ?? 0);
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
