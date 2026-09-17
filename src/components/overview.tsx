import { useMemo } from "react";
import {
  formatNumber,
  formatPct,
  getDaysInMonth,
  getTrackDay,
  sumBlock,
  calculateTrackTarget,
  calculateDailyTarget,
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
      // نسبة القسم = المحقق ÷ مستهدف الشهر الكلي (وليس مستهدف الـ 15 يوم)
      const achievementRatio = calculateRatio(target, actual);

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
    // دائرة الفرع الكلي = المحقق ÷ التراك (مستهدف حتى الأمس)
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
      <section className="rounded-2xl bg-card/90 p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Branch Target</h2>
        <div className="flex flex-col items-center gap-6">
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

          {/* Stats List — عمودي: كل كلمة بجانب رقمها */}
          <div className="flex w-full max-w-sm flex-col gap-2">
            <StatRow label="Target" value={formatNumber(branchTotal.target)} />
            <StatRow label="Track" value={formatNumber(branchTotal.track)} />
            <StatRow label="Actual" value={formatNumber(branchTotal.actual)} />
            <StatRow label="Remaining" value={formatNumber(Math.max(0, branchTotal.target - branchTotal.actual))} />
            <StatRow label="Daily Target" value={formatNumber(branchTotal.target / daysInMonth)} />
          </div>
        </div>
      </section>

      {/* Main KPI Performance Table */}
      <section className="rounded-2xl bg-card/90 p-3 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Main KPI performance</h2>

        <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-border">
                <th className="w-[20%] px-0.5 py-2 text-center text-[10px] font-semibold text-foreground sm:px-4 sm:text-xs">KPI</th>
                <th className="w-[27%] px-0.5 py-2 text-center text-[10px] font-semibold text-foreground sm:px-4 sm:text-xs">Track</th>
                <th className="w-[27%] px-0.5 py-2 text-center text-[10px] font-semibold text-foreground sm:px-4 sm:text-xs">Actual</th>
                <th className="w-[9%] px-0.5 py-2 text-center text-[10px] font-semibold text-foreground sm:px-4 sm:text-xs">%</th>
                <th className="w-[17%] px-0.5 py-2 text-center text-[10px] font-semibold text-foreground sm:px-4 sm:text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* KPI Rows: Gross, Agency, Boxi, Mylo, CR, GK */}
              {KPIS.map((kpi) => {
                const data = kpiData[kpi];
                return (
                  <tr key={kpi} className="border-b border-border">
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center text-[11px] font-medium text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {kpi === "BOXI" ? "Boxi" : kpi}
                    </td>
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {formatNumber(data.track)}
                    </td>
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {formatNumber(data.actual)}
                    </td>
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {formatPct(data.achievementRatio)}
                    </td>
                    <td className="px-0.5 py-2.5 text-center sm:px-4 sm:py-3">
                      <StatusPill ratio={data.achievementRatio} compact />
                    </td>
                  </tr>
                );
              })}

              {/* Group Rows: Mobile, MDA-SDA, TV-AC */}
              {SALES_GROUPS.map((group) => {
                const data = groupData[group.id];
                return (
                  <tr key={group.id} className="border-b border-border">
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center text-[11px] font-medium text-foreground sm:px-4 sm:py-3 sm:text-sm">{group.title}</td>
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {formatNumber(data.track)}
                    </td>
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {formatNumber(data.actual)}
                    </td>
                    <td className="whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[11px] tabular-nums text-foreground sm:px-4 sm:py-3 sm:text-sm">
                      {formatPct(data.achievementRatio)}
                    </td>
                    <td className="px-0.5 py-2.5 text-center sm:px-4 sm:py-3">
                      <StatusPill ratio={data.achievementRatio} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </section>

      {/* Bottom Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {SALES_GROUPS.map((group) => {
          const data = groupData[group.id];
          return (
            <div key={group.id} className="rounded-2xl bg-card/90 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">{group.title}</h3>
                <StatusPill ratio={data.achievementRatio} />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">
                  {formatPct(data.achievementRatio)}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-card-2/50 px-4 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function Overview(props: any) {
  return <OverviewView {...props} />;
}

export default OverviewView;
