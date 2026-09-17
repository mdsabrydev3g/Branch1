import { FileDown, Printer } from "lucide-react";
import {
  DEPS,
  SALES_GROUPS,
  calculate80PercentTarget,
  calculate85PercentTarget,
  calculateFirstHalfTarget,
  calculateRemaining,
  calculateSecondHalfTarget,
  calculateTrackTarget,
  firstHalfActualFromDaily,
  formatNumber,
  formatPct,
  getTrackDay,
  latestDailyValue,
  localDateString,
  monthActualFromDaily,
  showSecondHalf,
  KPIS,
  periodMeta,
  ratio,
  sumBlock,
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
import { SplitPair } from "@/components/department-view";

export function ReportsView() {
  const period = usePerfStore((s) => s.period);
  const block = usePerfStore((s) => s.data[period]);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const branchKpis = usePerfStore((s) => s.branchKpis);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const meta = periodMeta(period);
  const today = localDateString();
  const visibleSecond = showSecondHalf(period, today);

  const depValue = (dep: (typeof DEPS)[number]) => {
    const fallback = block[dep] ? sumBlock(block[dep]) : { plan: 0, result: 0 };
    const daily = departmentDailyActuals[period]?.[dep] ?? {};
    const target = departmentTargets[period]?.[dep] ?? fallback.plan;
    const actual = monthActualFromDaily(daily, fallback.result);
    const track = Math.round(calculateTrackTarget(target, period, today));
    return { target, actual, track };
  };

  const totals = DEPS.reduce(
    (total, dep) => {
      const v = depValue(dep);
      return { plan: total.plan + v.target, result: total.result + v.actual };
    },
    { plan: 0, result: 0 },
  );
  const totalRatio = ratio(totals);

  const branchFirstHalf = DEPS.reduce(
    (sum, dep) => sum + firstHalfActualFromDaily(departmentDailyActuals[period]?.[dep] ?? {}),
    0,
  );
  const firstHalfTarget = Math.round(calculateFirstHalfTarget(totals.plan, period));
  const eightyTarget = Math.round(calculate80PercentTarget(firstHalfTarget));
  const secondHalfTarget = Math.round(calculateSecondHalfTarget(totals.plan, period));
  const eightyFiveTarget = Math.round(calculate85PercentTarget(totals.plan));

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
        <Summary label="%" value={formatPct(totalRatio)} />
        <Summary
          label="Status"
          value={totalRatio >= 1 ? "Good" : totalRatio >= 0.8 ? "Will Do" : "Danger"}
        />
      </section>

      <section className="hairline print-surface rounded-2xl bg-card/80 p-4 sm:p-5">
        <div className="mb-3 border-b border-border pb-3">
          <h2 className="text-sm font-medium text-foreground">Target progress</h2>
          <p className="mt-1 text-xs text-subtle">First-half, second-half and milestone tracking</p>
        </div>
        <div className="flex flex-col gap-3">
          <SplitPair
            bp="md"
            left={
              <HalfSummary
                label="First half"
                target={firstHalfTarget}
                actual={branchFirstHalf}
              />
            }
            right={
              <HalfSummary
                label="80%"
                target={eightyTarget}
                actual={branchFirstHalf}
              />
            }
          />
          {visibleSecond && (
            <SplitPair
              bp="md"
              left={
                <HalfSummary
                  label="Second half"
                  target={totals.plan}
                  actual={totals.result}
                />
              }
              right={
                <HalfSummary
                  label="85%"
                  target={eightyFiveTarget}
                  actual={totals.result}
                />
              }
            />
          )}
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {SALES_GROUPS.map((group) => {
          const rows = group.deps.map((dep) => ({ dep, ...depValue(dep) }));
          const gTarget = rows.reduce((s, r) => s + r.target, 0);
          const gActual = rows.reduce((s, r) => s + r.actual, 0);
          const gRatio = ratio({ plan: gTarget, result: gActual });
          return (
            <section
              key={group.id}
              className="hairline print-surface rounded-2xl bg-card/80 p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-sm font-medium text-foreground">{group.title}</h2>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatPct(gRatio)}
                  </span>
                  <StatusPill ratio={gRatio} report />
                </div>
              </div>
              <div className="overflow-hidden">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-2xs uppercase tracking-wider text-subtle">
                      <th className="px-2 py-2 font-semibold">Department</th>
                      <th className="px-2 py-2 text-right font-semibold">Target</th>
                      <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell">Track</th>
                      <th className="px-2 py-2 text-right font-semibold">Actual</th>
                      <th className="px-2 py-2 text-right font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const rr = ratio({ plan: r.target, result: r.actual });
                      return (
                        <tr key={r.dep} className="border-b border-border/60 last:border-0">
                          <td className="truncate px-2 py-2.5 text-xs font-medium text-foreground sm:text-sm">
                            {r.dep}
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums text-muted sm:text-sm">
                            {formatNumber(r.target)}
                          </td>
                          <td className="hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums text-muted sm:table-cell sm:text-sm">
                            {formatNumber(r.track)}
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                            {formatNumber(r.actual)}
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono text-xs font-semibold tabular-nums text-muted sm:text-sm">
                            {formatPct(rr)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border">
                      <td className="px-2 py-2.5 text-xs font-bold text-foreground sm:text-sm">Total</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-foreground sm:text-sm">
                        {formatNumber(gTarget)}
                      </td>
                      <td className="hidden px-2 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-foreground sm:table-cell sm:text-sm">
                        {formatNumber(rows.reduce((s, r) => s + r.track, 0))}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-foreground sm:text-sm">
                        {formatNumber(gActual)}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-foreground sm:text-sm">
                        {formatPct(gRatio)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <ProgressBar value={gRatio} />
                <div className="mt-1 flex justify-between text-xs text-subtle">
                  <span>Actual / Target</span>
                  <span className="font-mono">{formatPct(gRatio)}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>

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
            const actual = latestDailyValue(branchDailyActuals[period]?.[kpi]);
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
  const achievement = ratio({ plan: target, result: actual });
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card-2/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-xs font-medium text-foreground">{label}</div>
        <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {formatPct(achievement)}
        </div>
      </div>
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
      <div className="mt-1 truncate font-mono text-lg tabular-nums text-foreground">
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
    const fallback = block[dep] ? sumBlock(block[dep]) : { plan: 0, result: 0 };
    const target = departmentTargets[period]?.[dep] ?? fallback.plan;
    const daily = departmentDailyActuals[period]?.[dep] ?? {};
    const actual = monthActualFromDaily(daily, fallback.result);
    const departmentRatio = ratio({ plan: target, result: actual });
    lines.push([dep, "Department total", String(target), String(actual), formatPct(departmentRatio), statusText(departmentRatio)]);
  }
  for (const kpi of KPIS) {
    const target = branchKpis[kpi]?.plan ?? 0;
    const actual = latestDailyValue(branchDailyActuals[period]?.[kpi]);
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
