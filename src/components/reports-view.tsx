import { FileDown, Printer } from "lucide-react";
import {
  DEPS,
  DEP_COPY,
  calculateDailyTarget,
  calculate80PercentTarget,
  calculate85PercentTarget,
  calculateFirstHalfTarget,
  calculateRemaining,
  calculateSecondHalfTarget,
  departmentFirstHalfActual,
  departmentMonthActual,
  departmentSecondHalfActual,
  formatNumber,
  formatPct,
  getTrackDay,
  isSecondHalfVisible,
  KPIS,
  latestDailyValue,
  periodMeta,
  ratio,
  sumBlock,
  todayISO,
  type PeriodBlock,
  type DepartmentDailyActuals,
  type DepartmentTargets,
  type BranchDailyActuals,
  type PeriodId,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";

export function ReportsView() {
  const period = usePerfStore((s) => s.period);
  const block = usePerfStore((s) => s.data[period]);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const branchKpis = usePerfStore((s) => s.branchKpis);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const meta = periodMeta(period);
  const today = todayISO();
  const totals = DEPS.reduce(
    (total, dep) => {
      const fallback = sumBlock(block[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      return {
        plan: total.plan + (departmentTargets[period]?.[dep] ?? fallback.plan),
        result: total.result + departmentMonthActual(daily, fallback.result),
      };
    },
    { plan: 0, result: 0 },
  );
  const firstHalfActual = DEPS.reduce(
    (total, dep) =>
      total +
      departmentFirstHalfActual(departmentDailyActuals[period]?.[dep] ?? {}),
    0,
  );
  const secondHalfActual = DEPS.reduce(
    (total, dep) =>
      total +
      departmentSecondHalfActual(departmentDailyActuals[period]?.[dep] ?? {}),
    0,
  );
  const showSecondHalf = isSecondHalfVisible(period, today);

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
        <Summary label="Index" value={formatPct(ratio(totals))} />
        <Summary
          label="Status"
          value={ratio(totals) >= 1 ? "Good" : ratio(totals) >= 0.8 ? "Will Do" : "Danger"}
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
            actual={firstHalfActual}
          />
          {showSecondHalf && (
            <HalfSummary
              label="Second half"
              target={calculateSecondHalfTarget(totals.plan, period)}
              actual={secondHalfActual}
            />
          )}
          <HalfSummary
            label="80% milestone"
            target={calculate80PercentTarget(totals.plan)}
            actual={totals.result}
          />
          <HalfSummary
            label="85% milestone"
            target={calculate85PercentTarget(totals.plan)}
            actual={totals.result}
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
      {DEPS.map((dep) => {
        const desk = sumBlock(block[dep]);
        const daily = departmentDailyActuals[period]?.[dep] ?? {};
        const deskTarget = departmentTargets[period]?.[dep] ?? desk.plan;
        const deskActual = departmentMonthActual(daily, desk.result);
        const track = Math.round(calculateDailyTarget(deskTarget, period) * getTrackDay(period, today));
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
            const daily = branchDailyActuals[period]?.[kpi] ?? {};
            const actual =
              kpi === "CR"
                ? latestDailyValue(daily)
                : Object.values(daily).reduce((sum, value) => sum + value, 0);
            const r = ratio({ plan: entry.plan, result: actual });
            return (
              <article key={kpi} className="rounded-xl border border-border bg-card-2/70 p-3">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                  <h3 className="text-sm font-medium text-foreground">{kpi}</h3>
                  <StatusPill ratio={r} report />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Summary label="Target" value={formatNumber(entry.plan)} />
                  <Summary label="Actual" value={formatNumber(actual)} />
                  <Summary label="Remaining" value={formatNumber(calculateRemaining(entry.plan, actual))} />
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
      <div className="mt-1 truncate font-mono text-xs font-medium tabular-nums text-foreground sm:text-sm">
        {value}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="hairline print-surface rounded-2xl bg-card/80 px-4 py-3">
      <div className="text-2xs tracking-wide text-subtle uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg tabular-nums text-foreground">
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
    const actual = departmentMonthActual(daily, fallback.result);
    const departmentRatio = ratio({ plan: target, result: actual });
    lines.push([dep, "Department total", String(target), String(actual), formatPct(departmentRatio), statusText(departmentRatio)]);
  }
  for (const kpi of KPIS) {
    const target = branchKpis[kpi]?.plan ?? 0;
    const daily = branchDailyActuals[period]?.[kpi] ?? {};
    const actual =
      kpi === "CR"
        ? latestDailyValue(daily)
        : Object.values(daily).reduce((sum, value) => sum + value, 0);
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
