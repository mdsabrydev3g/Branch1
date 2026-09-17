import { useMemo } from "react";
import {
  formatNumber,
  formatPct,
  getDaysInMonth,
  getTrackDay,
  sumBlock,
  calculateTrackTarget,
  calculateDailyTarget,
  statusOf,
  latestDailyValue,
  KPIS,
  SALES_GROUPS,
  DEPS,
  type Kpi,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";

// Helper function for ratio calculation
function calculateRatio(plan: number, result: number): number {
  if (!plan) return result > 0 ? 1 : 0;
  return result / plan;
}

export function OverviewView() {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const branchKpiTargets = usePerfStore((s) => s.branchKpiTargets);
  const branchKpis = usePerfStore((s) => s.branchKpis);
  const role = usePerfStore((s) => s.role);

  const block = data[period] || {};
  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period);

  // حساب القيم لكل قسم
  const deptData = useMemo(() => {
    const result: Record<
      Dep,
      {
        target: number;
        actual: number;
        track: number;
        dailyTarget: number;
      }
    > = {} as any;

    DEPS.forEach((dep) => {
      const fallback = sumBlock(block[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      const monthlyTarget = departmentTargets[period]?.[dep] ?? fallback.plan;

      // Actual = آخر محقق تراكمي تم إدخاله للأيام
      const latestVal = latestDailyValue(daily);
      const actual = latestVal > 0 ? latestVal : (Object.keys(daily).length > 0 ? latestVal : fallback.result);

      // Track = مستهدف حتى الأمس
      const track = calculateTrackTarget(monthlyTarget, period);

      // Daily Target = مستهدف يومي
      const dailyTarget = calculateDailyTarget(monthlyTarget, period);

      result[dep] = {
        target: monthlyTarget,
        actual,
        track,
        dailyTarget,
      };
    });

    return result;
  }, [block, period, departmentDailyActuals, departmentTargets]);

  // حساب القيم لكل KPI
  const kpiData = useMemo(() => {
    const result: Record<
      Kpi,
      {
        target: number;
        actual: number;
        track: number;
        dailyTarget: number;
        achievementRatio: number;
      }
    > = {} as any;

    const totalDepsTarget = DEPS.reduce((sum, dep) => sum + (deptData[dep]?.target || 0), 0);
    const totalDepsActual = DEPS.reduce((sum, dep) => sum + (deptData[dep]?.actual || 0), 0);

    KPIS.forEach((kpi) => {
      const daily = branchDailyActuals[period]?.[kpi] ?? {};
      const latestVal = latestDailyValue(daily);
      const enteredTarget = branchKpiTargets[period]?.[kpi] ?? branchKpis[kpi]?.plan ?? 0;
      const enteredActual = latestVal > 0 ? latestVal : (branchKpis[kpi]?.result ?? 0);

      // If Gross wasn't entered separately, fallback to sum of all departments
      const target = kpi === "Gross" && enteredTarget === 0 ? totalDepsTarget : enteredTarget;
      const actual = kpi === "Gross" && enteredActual === 0 ? totalDepsActual : enteredActual;

      const track = calculateTrackTarget(target, period);
      const dailyTarget = calculateDailyTarget(target, period);

      result[kpi] = {
        target,
        actual,
        track,
        dailyTarget,
        achievementRatio: calculateRatio(track, actual),
      };
    });

    return result;
  }, [deptData, period, branchDailyActuals, branchKpiTargets, branchKpis]);

  // حساب القيم لمجموعات الأقسام
  const groupData = useMemo(() => {
    const result: Record<
      string,
      {
        target: number;
        actual: number;
        track: number;
        achievementRatio: number;
      }
    > = {};

    SALES_GROUPS.forEach((group) => {
      let target = 0;
      let actual = 0;

      group.deps.forEach((dep) => {
        const deptInfo = deptData[dep];
        if (deptInfo) {
          target += deptInfo.target;
          actual += deptInfo.actual;
        }
      });

      const track = calculateTrackTarget(target, period);
      const achievementRatio = calculateRatio(track, actual);

      result[group.id] = {
        target,
        actual,
        track,
        achievementRatio,
      };
    });

    return result;
  }, [deptData, period]);

  // حساب إجمالي الفرع
  const branchTotal = useMemo(() => {
    let target = 0;
    let actual = 0;

    DEPS.forEach((dep) => {
      const deptInfo = deptData[dep];
      if (deptInfo) {
        target += deptInfo.target;
        actual += deptInfo.actual;
      }
    });

    const track = calculateTrackTarget(target, period);
    const achievementRatio = calculateRatio(track, actual);

    return {
      target,
      actual,
      track,
      achievementRatio,
    };
  }, [deptData, period]);

  const periodInfo = useMemo(() => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const [year, month] = period.split("-").map(Number);
    return `${monthNames[month - 1]} ${year}`;
  }, [period]);

  return (
    <div className="flex flex-col gap-6 px-4 py-6 fade-in">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-foreground uppercase tracking-wider">Branch Performance</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">Fayoum 1 Branch</span>
          <span className="text-sm text-subtle">{periodInfo}</span>
        </div>
      </div>

      {/* Branch Target Section */}
      <section className="rounded-2xl bg-card/90 p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Branch Target</h2>
        <div className="flex items-center gap-6">
          {/* Circular Progress */}
          <div className="flex flex-col items-center">
            <div className="relative mx-auto grid size-36 place-items-center">
              <svg viewBox="0 0 128 128" className="size-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  fill="none"
                  stroke="var(--color-card-3, #1e293b)"
                  strokeWidth="10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  fill="none"
                  stroke={
                    branchTotal.achievementRatio >= 1
                      ? "#10b981"
                      : branchTotal.achievementRatio >= 0.8
                        ? "#f59e0b"
                        : "#ef4444"
                  }
                  strokeWidth="10"
                  strokeDasharray={`${Math.min(339.292, 339.292 * Math.max(0, branchTotal.achievementRatio))} 339.292`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="font-mono text-3xl font-bold tabular-nums text-foreground">
                    {formatPct(branchTotal.achievementRatio)}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2">
              <StatusPill ratio={branchTotal.achievementRatio} />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="flex-1 grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xs uppercase text-subtle">Target</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {formatNumber(branchTotal.target)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xs uppercase text-subtle">Track</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {formatNumber(branchTotal.track)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xs uppercase text-subtle">Actual</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {formatNumber(branchTotal.actual)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xs uppercase text-subtle">Remaining</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {formatNumber(Math.max(0, branchTotal.target - branchTotal.actual))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xs uppercase text-subtle">Daily Target</div>
              <div className="font-mono text-sm font-semibold text-foreground">
                {formatNumber(branchTotal.target / daysInMonth)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main KPI Performance Table */}
      <section className="rounded-2xl bg-card/90 p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Main KPI performance</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">KPI</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">Track</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">Actual</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">%</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* KPI Rows: Gross, Agency, Boxi, Mylo, CR, GK */}
              {KPIS.map((kpi) => {
                const data = kpiData[kpi];
                return (
                  <tr key={kpi} className="border-b border-border">
                    <td className="px-4 py-3 text-center text-sm font-medium text-foreground">
                      {kpi === "BOXI" ? "Boxi" : kpi}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {formatNumber(data.track)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {formatNumber(data.actual)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {formatPct(data.achievementRatio)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill ratio={data.achievementRatio} />
                    </td>
                  </tr>
                );
              })}

              {/* Group Rows: Mobile, MDA-SDA, TV-AC */}
              {SALES_GROUPS.map((group) => {
                const data = groupData[group.id];
                return (
                  <tr key={group.id} className="border-b border-border">
                    <td className="px-4 py-3 text-center text-sm font-medium text-foreground">{group.title}</td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {formatNumber(data.track)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {formatNumber(data.actual)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-foreground">
                      {formatPct(data.achievementRatio)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill ratio={data.achievementRatio} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SALES_GROUPS.map((group) => {
          const data = groupData[group.id];
          const status = statusOf(data.achievementRatio);
          return (
            <div key={group.id} className="rounded-2xl bg-card/90 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">{group.title}</h3>
                <StatusPill ratio={data.achievementRatio} />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">
                  {formatPct(data.achievementRatio)}
                </div>
                <div className="mt-2 text-xs text-subtle">
                  {group.deps.join(" · ")}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function Overview(props: any) {
  return <OverviewView {...props} />;
}

export default OverviewView;
