import {
  DEP_VIEW,
  formatNumber,
  formatPct,
  FIXED_KPI_TARGETS,
  getDaysInMonth,
  periodMeta,
  ratio,
  SALES_GROUPS,
  KPIS,
  sumBlock,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { IndexRing } from "@/components/charts";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { StatInput } from "@/components/stat-input";
import { cn } from "@/lib/utils";

// دالة مساعدة لجلب القيمة التراكمية الصحيحة بدلاً من جمع الأيام السابقة مضاعفةً
function getCumulativeActual(dailyObj: Record<string, number>, fallbackResult: number): number {
  const values = Object.values(dailyObj);
  if (values.length === 0) return fallbackResult;
  // أخذ القيمة التراكمية الأخيرة المدخلة مباشرة لمنع المضاعفة
  return Math.max(...values, 0);
}

export function Overview() {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const setView = usePerfStore((s) => s.setView);
  const branchKpis = usePerfStore((s) => s.branchKpis);
  const setBranchValue = usePerfStore((s) => s.setBranchValue);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const setBranchDailyActual = usePerfStore((s) => s.setBranchDailyActual);
  const role = usePerfStore((s) => s.role);
  const today = new Date().toISOString().slice(0, 10);
  const block = data[period];

  const totals = SALES_GROUPS.reduce(
    (total, group) =>
      group.deps.reduce(
        (groupTotal, dep) => {
          const part = sumBlock(block[dep]);
          const daily = departmentDailyActuals[period]?.[dep] ?? {};
          const cumulativeResult = getCumulativeActual(daily, part.result);
          return {
            plan:
              groupTotal.plan +
              (departmentTargets[period]?.[dep] ?? part.plan),
            result: groupTotal.result + cumulativeResult,
          };
        },
        total,
      ),
    { plan: 0, result: 0 },
  );

  const index = ratio(totals);
  const meta = periodMeta(period);
  const trackDay = getTrackDay(period, today);
  const branchTargetThroughYesterday =
    totals.plan > 0 ? (totals.plan / getDaysInMonth(period)) * trackDay : 0;

  const branchActual = totals.result;

  const branchTrackIndex = ratio({
    plan: branchTargetThroughYesterday,
    result: branchActual,
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-kicker text-primary uppercase">
          Branch performance
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Fayoum 1 Branch
        </h1>
        <p className="max-w-xl text-pretty text-sm text-muted">
          {meta.label}
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="hairline print-surface rounded-2xl bg-card/80 p-5 lg:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Branch Target</h2>
            <StatusPill ratio={branchTrackIndex} />
          </div>
          <IndexRing value={branchTrackIndex} />
          <dl className="mt-3 space-y-2">
            <MicroStat label="Target" value={formatNumber(totals.plan)} />
            <MicroStat label="Track" value={formatNumber(branchTargetThroughYesterday)} />
            <MicroStat label="Actual" value={formatNumber(branchActual)} />
            <MicroStat
              label="Remaining"
              value={formatNumber(Math.max(0, totals.plan - branchActual))}
            />
            <MicroStat
              label="Daily Target"
              value={formatNumber(totals.plan / getDaysInMonth(period))}
            />
          </dl>
        </div>

        <div className="hairline print-surface overflow-hidden rounded-2xl bg-card/80 lg:col-span-8">
          <div className="px-5 py-4">
            <h2 className="text-sm font-medium text-foreground">Main KPI performance</h2>
            <p className="text-xs text-subtle">Actual through yesterday versus the target through yesterday</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-y border-border text-xs tracking-wide text-subtle uppercase">
                  <th className="px-5 py-3 font-medium">KPI</th>
                  <th className="border-l border-border px-3 py-3 font-medium">Target</th>
                  <th className="border-l border-border px-3 py-3 font-medium">Track</th>
                  <th className="border-l border-border px-3 py-3 font-medium">Actual</th>
                  <th className="border-l border-border px-3 py-3 font-medium">Remaining</th>
                  <th className="border-l border-border px-3 py-3 font-medium">Actual / Track</th>
                  <th className="border-l border-border px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {SALES_GROUPS.map((group) => {
                  const groupTotals = group.deps.reduce(
                    (total, dep) => {
                      const fallback = sumBlock(block[dep]);
                      const daily = departmentDailyActuals[period]?.[dep] ?? {};
                      const target = departmentTargets[period]?.[dep] ?? fallback.plan;
                      const actual = getCumulativeActual(daily, fallback.result);
                      return {
                        target: total.target + target,
                        actual: total.actual + actual,
                      };
                    },
                    { target: 0, actual: 0 },
                  );
                  const groupTrack =
                    (groupTotals.target / getDaysInMonth(period)) * trackDay;
                  const groupRatio = ratio({
                    plan: groupTrack,
                    result: groupTotals.actual,
                  });
                  return (
                    <tr key={group.id} className="border-b border-border bg-card-2/35">
                      <td className="px-5 py-3 text-sm font-semibold text-foreground">
                        {group.title}
                      </td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm font-semibold tabular-nums text-muted">
                        {formatNumber(groupTotals.target)}
                      </td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm font-semibold tabular-nums text-muted">
                        {formatNumber(groupTrack)}
                      </td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatNumber(groupTotals.actual)}
                      </td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm font-semibold tabular-nums text-muted">
                        {formatNumber(Math.max(0, groupTotals.target - groupTotals.actual))}
                      </td>
                      <td className="border-l border-border px-3 py-3">
                        <span className="font-mono text-xs font-semibold tabular-nums text-muted">
                          {formatPct(groupRatio)}
                        </span>
                      </td>
                      <td className="border-l border-border px-5 py-3">
                        <StatusPill ratio={groupRatio} />
                      </td>
                    </tr>
                  );
                })}
                {KPIS.map((kpi) => {
                  const entry = branchKpis[kpi];
                  const daily = branchDailyActuals[period]?.[kpi] ?? {};
                  const trackDay = getTrackDay(period, today);
                  const fixedTarget = FIXED_KPI_TARGETS[kpi];
                  const target = fixedTarget ?? entry.plan;
                  const targetThroughYesterday =
                    fixedTarget !== undefined
                      ? fixedTarget
                      : (target / getDaysInMonth(period)) * trackDay;
                  const actualCumulative = getCumulativeActual(daily, entry.result);
                  const kpiRatio = ratio({
                    plan: fixedTarget !== undefined ? target : targetThroughYesterday,
                    result: actualCumulative,
                  });
                  return (
                    <tr key={kpi} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{kpi}</td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm tabular-nums text-muted">{formatNumber(target)}</td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm tabular-nums text-muted">{fixedTarget !== undefined ? "—" : formatNumber(targetThroughYesterday)}</td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm tabular-nums text-foreground">{formatNumber(actualCumulative)}</td>
                      <td className="border-l border-border px-3 py-3 font-mono text-sm tabular-nums text-muted">{formatNumber(Math.max(0, target - actualCumulative))}</td>
                      <td className="border-l border-border px-3 py-3">
                        <div className="flex min-w-20 items-center gap-2">
                          <span className="w-10 font-mono text-xs tabular-nums text-muted">{formatPct(kpiRatio)}</span>
                        </div>
                      </td>
                      <td className="border-l border-border px-5 py-3"><StatusPill ratio={kpiRatio} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SALES_GROUPS.map((group) => {
          const entry = group.deps.reduce(
            (total, dep) => {
              const part = sumBlock(block[dep]);
              const daily = departmentDailyActuals[period]?.[dep] ?? {};
              const actual = getCumulativeActual(daily, part.result);
              return {
                plan:
                  total.plan +
                  (departmentTargets[period]?.[dep] ?? part.plan),
                result: total.result + actual,
              };
            },
            { plan: 0, result: 0 },
          );
          const r = ratio(entry);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setView(DEP_VIEW[group.deps[0]])}
              className="hairline pressable print-surface rounded-2xl bg-card/80 p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {group.title}
                  </div>
                  <div className="mt-0.5 text-xs text-subtle">
                    {group.deps.join(" · ")}
                  </div>
                </div>
                <StatusPill ratio={r} />
              </div>
              <div className="mt-4 flex items-end justify-between">
                <span className="font-mono text-2xl font-medium tabular-nums tracking-tight text-foreground">
                  {formatPct(r)}
                </span>
                <span className="text-xs text-subtle">
                  {formatNumber(entry.result)}
                </span>
              </div>
              <ProgressBar value={r} className="mt-3" />
            </button>
          );
        })}
      </section>

      {role === "manager" && (
      <section className="hairline print-surface overflow-hidden rounded-2xl bg-card/80">
        <div className="flex flex-col gap-1 px-5 py-4">
          <h2 className="text-sm font-medium text-foreground">Main KPIs</h2>
          <p className="text-xs text-subtle">
            Enter the monthly target for each branch KPI here. Daily actuals are tracked separately in the manager view.
          </p>
        </div>
        <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPIS.map((kpi) => {
            const entry = branchKpis[kpi];
            const daily = branchDailyActuals[period]?.[kpi] ?? {};
            const actual = getCumulativeActual(daily, entry.result);
            return (
              <article key={kpi} className="rounded-xl bg-card-2/70 p-3">
                <div className="mb-2 text-sm font-medium text-foreground">{kpi}</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatInput
                    label="Monthly Target"
                    value={FIXED_KPI_TARGETS[kpi] ?? entry.plan}
                    onChange={(value) => setBranchValue(kpi, "plan", value)}
                    disabled={FIXED_KPI_TARGETS[kpi] !== undefined}
                  />
                  <StatInput
                    label="Cumulative Actual"
                    value={daily[today] ?? actual}
                    onChange={(value) => setBranchDailyActual(kpi, today, value)}
                    disabled={false}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-subtle">
                  <span>Actual: <span className="font-mono text-foreground">{formatNumber(actual)}</span></span>
                  <span>{formatPct(ratio({ plan: entry.plan, result: actual }))}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      )}

      <section className="hairline print-surface overflow-hidden rounded-2xl bg-card/80">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">Desk scorecard</h2>
            <p className="text-xs text-subtle">Live from current period inputs</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-border text-xs tracking-wide text-subtle uppercase">
                <th className="px-5 py-3 font-medium">Desk</th>
                <th className="border-l border-border px-3 py-3 font-medium">Plan</th>
                <th className="border-l border-border px-3 py-3 font-medium">Result</th>
                <th className="border-l border-border px-3 py-3 font-medium">Index</th>
                <th className="border-l border-border px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {SALES_GROUPS.map((group) => {
                const entry = group.deps.reduce(
                  (total, dep) => {
                    const part = sumBlock(block[dep]);
                    const daily = departmentDailyActuals[period]?.[dep] ?? {};
                    const actual = getCumulativeActual(daily, part.result);
                    return {
                      plan:
                        total.plan +
                        (departmentTargets[period]?.[dep] ?? part.plan),
                      result: total.result + actual,
                    };
                  },
                  { plan: 0, result: 0 },
                );
                const r = ratio(entry);
                return (
                  <tr key={group.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => setView(DEP_VIEW[group.deps[0]])}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {group.title}
                      </button>
                    </td>
                    <td className="border-l border-border px-3 py-3.5 font-mono text-sm tabular-nums text-muted">
                      {formatNumber(entry.plan)}
                    </td>
                    <td className="border-l border-border px-3 py-3.5 font-mono text-sm tabular-nums text-foreground">
                      {formatNumber(entry.result)}
                    </td>
                    <td className="border-l border-border px-3 py-3.5">
                      <div className="flex min-w-36 items-center gap-2">
                        <ProgressBar value={r} className="flex-1" />
                        <span className="w-10 font-mono text-xs tabular-nums text-muted">
                          {formatPct(r)}
                        </span>
                      </div>
                    </td>
                    <td className="border-l border-border px-5 py-3.5">
                      <StatusPill ratio={r} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card-2/80 px-3 py-2.5">
      <dt className="text-2xs tracking-wide text-subtle uppercase">
        {label}
      </dt>
      <dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function getTrackDay(period: string, today: string): number {
  const currentPeriod = today.slice(0, 7);
  if (period < currentPeriod) {
    const [year, month] = period.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  }
  if (period > currentPeriod) return 0;
  return Math.max(0, Number(today.slice(-2)) - 1);
}
