import { useMemo } from "react";
import {
  formatNumber,
<<<<<<< HEAD
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
=======
  cumAtDay,
  calculateTrackTarget,
  calculateDailyTarget,
  FIXED_KPI_TARGETS,
  BRANCH_MINI_KPIS,
  TABLE_KPIS,
  SALES_GROUPS,
  DEPS,
  getDaysInMonth,
  getTrackDay,
  sumBlock,
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
  type Kpi,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
<<<<<<< HEAD
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";
=======
import { cn } from "@/lib/utils";
import {
  perfOf,
  toneTextClass,
  formatPct1,
  type PerfTone,
} from "@/components/sales-common";
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)

// Helper function for ratio calculation
function calculateRatio(plan: number, result: number): number {
  if (!plan) return result > 0 ? 1 : 0;
  return result / plan;
}

<<<<<<< HEAD
=======
const CIRCLE_STROKE: Record<PerfTone, string> = {
  excellent: "#10b981",
  good: "#10b981",
  willdo: "#f59e0b",
  danger: "#ef4444",
  none: "#475569",
};

>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
export function OverviewView() {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const branchKpiTargets = usePerfStore((s) => s.branchKpiTargets);
  const branchKpis = usePerfStore((s) => s.branchKpis);
<<<<<<< HEAD
  const role = usePerfStore((s) => s.role);
=======
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)

  const block = data[period] || {};
  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period);

<<<<<<< HEAD
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
=======
  // حساب القيم لكل قسم — القيم المخزّنة قراءات تراكمية: المحقق = آخر قراءة حتى الأمس
  const deptData = useMemo(() => {
    const result: Record<
      Dep,
      { target: number; actual: number; track: number; dailyTarget: number }
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
    > = {} as any;

    DEPS.forEach((dep) => {
      const fallback = sumBlock(block[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      const monthlyTarget = departmentTargets[period]?.[dep] ?? fallback.plan;
<<<<<<< HEAD

      // Actual = آخر محقق تراكمي تم إدخاله للأيام
      const latestVal = latestDailyValue(daily);
      const actual = latestVal > 0 ? latestVal : (Object.keys(daily).length > 0 ? latestVal : fallback.result);

      // Track = مستهدف حتى الأمس
      const track = calculateTrackTarget(monthlyTarget, period);

      // Daily Target = مستهدف يومي
      const dailyTarget = calculateDailyTarget(monthlyTarget, period);
=======
      const actual = Object.keys(daily).length > 0 ? cumAtDay(daily, trackDay) : fallback.result;
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)

      result[dep] = {
        target: monthlyTarget,
        actual,
<<<<<<< HEAD
        track,
        dailyTarget,
=======
        track: calculateTrackTarget(monthlyTarget, period),
        dailyTarget: calculateDailyTarget(monthlyTarget, period),
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
      };
    });

    return result;
<<<<<<< HEAD
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
=======
  }, [block, period, departmentDailyActuals, departmentTargets, trackDay]);

  // حساب القيم لكل KPI — قراءة تراكمية (CR نسبة شهرية: القراءة نفسها)
  const kpiData = useMemo(() => {
    const result: Record<
      Kpi,
      { target: number; actual: number; track: number; dailyTarget: number; achievementRatio: number }
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
    > = {} as any;

    const totalDepsTarget = DEPS.reduce((sum, dep) => sum + (deptData[dep]?.target || 0), 0);
    const totalDepsActual = DEPS.reduce((sum, dep) => sum + (deptData[dep]?.actual || 0), 0);

<<<<<<< HEAD
    KPIS.forEach((kpi) => {
      const daily = branchDailyActuals[period]?.[kpi] ?? {};
      const latestVal = latestDailyValue(daily);
      const enteredTarget = branchKpiTargets[period]?.[kpi] ?? branchKpis[kpi]?.plan ?? 0;
      const enteredActual = latestVal > 0 ? latestVal : (branchKpis[kpi]?.result ?? 0);

      // If Gross wasn't entered separately, fallback to sum of all departments
      const target = kpi === "Gross" && enteredTarget === 0 ? totalDepsTarget : enteredTarget;
      const actual = kpi === "Gross" && enteredActual === 0 ? totalDepsActual : enteredActual;

      // CR معدل تحويل (%): مستهدفه ثابت طوال الشهر — لا تقسيم نصف أول/ثاني
      // النسبة = آخر قراءة مُدخلة ÷ الرقم المكتوب في خانة CR (مثال 16 ÷ 20 = 80%)
      const isRateKpi = kpi === "CR";
=======
    (["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"] as Kpi[]).forEach((kpi) => {
      const isRateKpi = kpi === "CR";
      const daily = branchDailyActuals[period]?.[kpi] ?? {};
      const hasDaily = Object.keys(daily).length > 0;
      const latestVal = cumAtDay(daily, trackDay);
      const enteredTarget =
        branchKpiTargets[period]?.[kpi] ??
        FIXED_KPI_TARGETS[kpi] ??
        branchKpis[kpi]?.plan ??
        0;
      const enteredActual = hasDaily ? latestVal : (branchKpis[kpi]?.result ?? 0);

      const target = kpi === "Gross" && enteredTarget === 0 ? totalDepsTarget : enteredTarget;
      const actual = kpi === "Gross" && enteredActual === 0 ? totalDepsActual : enteredActual;

      // CR نسبة شهرية: النسبة = المحقق ÷ المستهدف مباشرة (بدون تقسيم لأنصاف الشهر)
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
      const track = isRateKpi ? target : calculateTrackTarget(target, period);
      const dailyTarget = isRateKpi ? 0 : calculateDailyTarget(target, period);

      result[kpi] = {
        target,
        actual,
        track,
        dailyTarget,
        achievementRatio: calculateRatio(track, actual),
      };
    });

    return result;
<<<<<<< HEAD
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
=======
  }, [deptData, period, branchDailyActuals, branchKpiTargets, branchKpis, trackDay]);

  // حساب القيم لمجموعات الأقسام
  const groupData = useMemo(() => {
    const result: Record<string, { target: number; actual: number; track: number; achievementRatio: number }> = {};
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)

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

<<<<<<< HEAD
      const track = calculateTrackTarget(target, period);
      // نسبة القسم = المحقق ÷ مستهدف الشهر الكلي (وليس مستهدف الـ 15 يوم)
      const achievementRatio = calculateRatio(target, actual);

      result[group.id] = {
        target,
        actual,
        track,
        achievementRatio,
=======
      result[group.id] = {
        target,
        actual,
        track: calculateTrackTarget(target, period),
        // نسبة القسم = المحقق ÷ مستهدف الشهر الكلي
        achievementRatio: calculateRatio(target, actual),
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
      };
    });

    return result;
  }, [deptData, period]);

<<<<<<< HEAD
  // إجمالي الفرع = نفس قيم Gross في جدول Main KPI حتى تتطابق الدائرة
  // (Target/Track/Actual) مع صف Gross بدل مجموع الأقسام
  const branchTotal = useMemo(() => {
    const gross = kpiData["Gross"];
    if (!gross) return { target: 0, actual: 0, track: 0, achievementRatio: 0 };
    // دائرة الفرع = المحقق ÷ التراك (مستهدف حتى الأمس) — نفس نسبة صف Gross
    return {
      target: gross.target,
      actual: gross.actual,
      track: gross.track,
      achievementRatio: gross.achievementRatio,
    };
  }, [kpiData]);
=======
  // إجمالي الفرع — الدائرة = المحقق ÷ التراك
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
    return { target, actual, track, achievementRatio: calculateRatio(track, actual) };
  }, [deptData, period]);

  const branchTone = perfOf(branchTotal.actual, branchTotal.track).tone;
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)

  const periodInfo = useMemo(() => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
<<<<<<< HEAD
      "July", "August", "September", "October", "November", "December"
=======
      "July", "August", "September", "October", "November", "December",
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
    ];
    const [year, month] = period.split("-").map(Number);
    return `${monthNames[month - 1]} ${year}`;
  }, [period]);

<<<<<<< HEAD
  // عتبات الدائرة فقط — أخضر ≥90%، أصفر 80–89%، أحمر تحت 80%.
  // باقي المشروع بعتباته الأصلية.
  const circleRatio = branchTotal.achievementRatio;
  const circleStroke =
    circleRatio >= 0.9 ? "#10b981" : circleRatio >= 0.8 ? "#f59e0b" : "#ef4444";
  const circleLabel =
    circleRatio >= 0.9 ? "Good" : circleRatio >= 0.8 ? "Will Do" : "Danger";
  const circlePillTone =
    circleRatio >= 0.9
      ? "border-success/30 bg-success/12 text-success shadow-[0_0_15px_rgba(78,201,155,0.3)]"
      : circleRatio >= 0.8
        ? "border-warning/30 bg-warning/12 text-warning shadow-[0_0_15px_rgba(232,180,94,0.3)]"
        : "border-danger/30 bg-danger/12 text-danger shadow-[0_0_15px_rgba(240,128,128,0.3)]";

  return (
    <div className="flex flex-col gap-6 px-4 py-6 fade-in">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-xl font-bold text-foreground uppercase tracking-wider">Branch Performance</h1>
=======
  return (
    <div className="flex flex-col gap-5 px-2 py-5 sm:px-4 fade-in">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">Branch Performance</h1>
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">Fayoum 1 Branch</span>
          <span className="text-sm text-subtle">{periodInfo}</span>
        </div>
      </div>

<<<<<<< HEAD
      {/* Branch Target Section */}
      <section className="rounded-2xl bg-card/90 p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Branch Target</h2>
        <div className="flex flex-col items-center gap-6">
          {/* Circular Progress */}
          <div className="flex flex-col items-center">
            <div className="relative mx-auto grid size-36 place-items-center">
              <svg viewBox="0 0 128 128" className="size-full -rotate-90">
=======
      {/* Branch Target — الدائرة والإحصائيات بجانبها + كروت CR/GK/Gift */}
      <section className="rounded-2xl bg-card/90 p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Branch Target</h2>

        {/* RTL: الدائرة يميناً + المؤشرات يسارها — نفس التخطيط الأفقي على كل المقاسات بما فيها الموبايل */}
        <div className="flex items-center justify-center gap-3 py-2 sm:gap-8 lg:gap-12">
          {/* Circular Progress + Status — يمين */}
          <div className="flex shrink-0 flex-col items-center">
            <div className="relative grid size-28 place-items-center min-[420px]:size-32 sm:size-40">
              <svg viewBox="0 0 128 128" className="size-full -rotate-90">
                <circle cx="64" cy="64" r="54" fill="none" stroke="var(--color-card-3, #1e293b)" strokeWidth="10" />
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  fill="none"
<<<<<<< HEAD
                  stroke="var(--color-card-3, #1e293b)"
                  strokeWidth="10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  fill="none"
                  stroke={circleStroke}
=======
                  stroke={CIRCLE_STROKE[branchTone]}
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
                  strokeWidth="10"
                  strokeDasharray={`${Math.min(339.292, 339.292 * Math.max(0, branchTotal.achievementRatio))} 339.292`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
<<<<<<< HEAD
                <div className="text-center">
                  <div className="font-mono text-3xl font-bold tabular-nums text-foreground">
                    {formatPct(branchTotal.achievementRatio)}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-2">
              {/* حبة الدائرة فقط بعتباتها الخاصة — باقي المشروع كما هو */}
              <span
                className={cn(
                  "inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold tracking-wide transition-all duration-300",
                  circlePillTone,
                )}
              >
                {circleLabel}
              </span>
            </div>
          </div>

          {/* Stats List — عمودي: كل كلمة بجانب رقمها */}
=======
                <div className={cn("font-mono text-2xl font-bold tabular-nums sm:text-3xl", toneTextClass(branchTone))}>
                  {formatPct1(branchTotal.achievementRatio)}
                </div>
              </div>
            </div>
            <StatusWord tone={branchTone} />
          </div>

          {/* Stats — يسار الدائرة مباشرة */}
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
          <div className="flex w-full max-w-sm flex-col gap-2">
            <StatRow label="Target" value={formatNumber(branchTotal.target)} />
            <StatRow label="Track" value={formatNumber(branchTotal.track)} />
            <StatRow label="Actual" value={formatNumber(branchTotal.actual)} />
            <StatRow label="Remaining" value={formatNumber(Math.max(0, branchTotal.target - branchTotal.actual))} />
            <StatRow label="Daily Target" value={formatNumber(branchTotal.target / daysInMonth)} />
          </div>
        </div>
<<<<<<< HEAD
      </section>

      {/* Main KPI Performance Table */}
=======

        {/* CR / GK / Gift — كل بند في صف واحد بعرض الصفحة */}
        <div className="mt-5 flex flex-col gap-2">
          {BRANCH_MINI_KPIS.map((kpi) => {
            const d = kpiData[kpi];
            const tone = perfOf(d.actual, d.target).tone;
            const cardRatio = d.target > 0 ? d.actual / d.target : 0;
            const targetLabel = kpi === "CR" ? `${formatNumber(d.target)}%` : formatNumber(d.target);
            const actualLabel = kpi === "CR" ? `${formatNumber(d.actual)}%` : formatNumber(d.actual);
            return (
              <div
                key={kpi}
                className="grid grid-cols-[minmax(40px,0.85fr)_minmax(72px,1.05fr)_minmax(72px,1.05fr)_minmax(40px,0.65fr)_minmax(64px,0.85fr)] items-center gap-1 rounded-xl border border-border bg-card-2/50 px-2 py-2.5 sm:grid-cols-[minmax(60px,0.9fr)_minmax(90px,1.1fr)_minmax(90px,1.1fr)_minmax(56px,0.8fr)_minmax(76px,0.9fr)] sm:gap-3 sm:px-4"
              >
                <span className="justify-self-start text-xs font-bold text-foreground sm:text-sm">{kpi}</span>
                <span className="flex min-w-0 items-baseline justify-between gap-1 sm:gap-2">
                  <span className="text-2xs text-subtle sm:text-xs">Target</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">{targetLabel}</span>
                </span>
                <span className="flex min-w-0 items-baseline justify-between gap-1 sm:gap-2">
                  <span className="text-2xs text-subtle sm:text-xs">Actual</span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">{actualLabel}</span>
                </span>
                <span className={cn("justify-self-end text-right font-mono text-xs font-bold tabular-nums sm:text-sm", toneTextClass(tone))}>
                  {tone === "none" ? "—" : formatPct1(cardRatio)}
                </span>
                <span className="flex justify-center sm:justify-end">
                  <StatusWord tone={tone} compact />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main KPI Performance — جدول أعمدة وصفوف، KPI محاذي يساراً */}
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
      <section className="rounded-2xl bg-card/90 p-3 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Main KPI performance</h2>

        <table className="w-full table-fixed">
<<<<<<< HEAD
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

      {/* Bottom Cards — compact stacked rows on mobile so all 3 sections
          stay visible under the KPI table; 3-column grid on sm+ */}
      <section className="rounded-2xl bg-card/90 px-4 py-1 sm:hidden">
        {SALES_GROUPS.map((group, i) => {
          const data = groupData[group.id];
          return (
            <div
              key={group.id}
              className={`flex items-center justify-between gap-2 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="text-sm font-semibold text-foreground">{group.title}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold tabular-nums text-foreground">
                  {formatPct(data.achievementRatio)}
                </span>
                <StatusPill ratio={data.achievementRatio} compact />
              </div>
            </div>
          );
        })}
      </section>
      <section className="hidden grid-cols-3 gap-4 sm:grid">
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
=======
          <thead>
            <tr className="bg-gradient-to-r from-card-3 to-card-2 shadow-[inset_0_-1px_0_rgba(107,158,255,0.35)]">
              <th className="w-[20%] px-1 py-2.5 text-left text-[10px] font-bold text-foreground sm:px-3 sm:text-xs">KPI</th>
              <th className="w-[18%] px-0.5 py-2.5 text-center text-[10px] font-bold text-foreground sm:px-3 sm:text-xs">Target</th>
              <th className="w-[18%] px-0.5 py-2.5 text-center text-[10px] font-bold text-foreground sm:px-3 sm:text-xs">Track</th>
              <th className="w-[18%] px-0.5 py-2.5 text-center text-[10px] font-bold text-foreground sm:px-3 sm:text-xs">Actual</th>
              <th className="w-[12%] px-0.5 py-2.5 text-center text-[10px] font-bold text-foreground sm:px-3 sm:text-xs">%</th>
              <th className="w-[14%] px-0.5 py-2.5 text-center text-[10px] font-bold text-foreground sm:px-3 sm:text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_KPIS.map((kpi) => {
              const d = kpiData[kpi];
              const tone = perfOf(d.actual, d.track).tone;
              return (
                <tr key={kpi} className="border-b border-border">
                  <td className="whitespace-nowrap px-1 py-2.5 text-left text-[11px] font-medium text-foreground sm:px-3 sm:py-3 sm:text-sm">
                    {kpi === "BOXI" ? "Boxi" : kpi}
                  </td>
                  <td className={numCell()}>
                    {formatNumber(d.target)}
                  </td>
                  <td className={numCell()}>
                    {formatNumber(d.track)}
                  </td>
                  <td className={numCell(true)}>
                    {formatNumber(d.actual)}
                  </td>
                  <td className={cn(numCell(true), toneTextClass(tone))}>
                    {formatPct0(d.achievementRatio)}
                  </td>
                  <td className="px-0.5 py-2.5 text-center sm:px-3 sm:py-3">
                    <StatusWord tone={tone} compact />
                  </td>
                </tr>
              );
            })}

            {SALES_GROUPS.map((group) => {
              const d = groupData[group.id];
              const tone = perfOf(d.actual, d.target).tone;
              return (
                <tr key={group.id} className="border-b border-border">
                  <td className="whitespace-nowrap px-1 py-2.5 text-left text-[11px] font-medium text-foreground sm:px-3 sm:py-3 sm:text-sm">
                    {group.title}
                  </td>
                  <td className={numCell()}>
                    {formatNumber(d.target)}
                  </td>
                  <td className={numCell()}>
                    {formatNumber(d.track)}
                  </td>
                  <td className={numCell(true)}>
                    {formatNumber(d.actual)}
                  </td>
                  <td className={cn(numCell(true), toneTextClass(tone))}>
                    {formatPct0(d.achievementRatio)}
                  </td>
                  <td className="px-0.5 py-2.5 text-center sm:px-3 sm:py-3">
                    <StatusWord tone={tone} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* أقسام المبيعات — كل قسم في سطر واحد */}
      <section className="rounded-2xl bg-card/90 p-3 sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-foreground">Sales Sections</h2>
        <div className="flex flex-col gap-2">
          {SALES_GROUPS.map((group) => {
            const d = groupData[group.id];
            const tone = perfOf(d.actual, d.target).tone;
            return (
              <div
                key={group.id}
                className="grid grid-cols-[minmax(80px,1fr)_auto_minmax(80px,1fr)] items-center gap-2 rounded-xl bg-card-2/50 px-3 py-2.5 sm:gap-4 sm:px-4"
              >
                <span className="justify-self-start text-xs font-semibold text-foreground sm:text-sm">
                  {group.title}
                </span>
                <span
                  className={cn(
                    "justify-self-center font-mono text-sm font-bold tabular-nums sm:text-lg",
                    toneTextClass(tone),
                  )}
                >
                  {formatPct0(d.achievementRatio)}
                </span>
                <span className="justify-self-end">
                  <StatusWord tone={tone} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer credit */}
      <footer className="mt-2 border-t border-border pt-4 text-center">
        <p className="text-xs font-medium text-subtle">Created By Mohamed Sabry</p>
        <p className="text-2xs text-subtle">Sep 2026</p>
      </footer>
>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
    </div>
  );
}

<<<<<<< HEAD
=======
function numCell(bold = false) {
  return cn(
    "whitespace-nowrap px-0.5 py-2.5 text-center font-mono text-[10px] tabular-nums text-foreground sm:px-3 sm:py-3 sm:text-sm",
    bold && "font-semibold",
  );
}

/** نسبة صحيحة بلا كسور (عرض فقط — الحسابات الداخلية تبقى بدقتها الكاملة) */
export function formatPct0(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-card-2/50 px-4 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

<<<<<<< HEAD
=======
/** كلمة الحالة بنفس نظام الأقسام: Excellent / Good / Will Do / Danger */
function StatusWord({ tone, compact = false }: { tone: PerfTone; compact?: boolean }) {
  const WORD: Record<PerfTone, { label: string; cls: string }> = {
    excellent: { label: "Excellent", cls: "border-emerald-300/40 bg-emerald-400/15 text-emerald-300" },
    good: { label: "Good", cls: "border-success/30 bg-success/12 text-success" },
    willdo: { label: "Will Do", cls: "border-warning/30 bg-warning/12 text-warning" },
    danger: { label: "Danger", cls: "border-danger/30 bg-danger/12 text-danger" },
    none: { label: "—", cls: "border-border bg-card-2/60 text-subtle" },
  };
  const w = WORD[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center self-center whitespace-nowrap rounded-full border font-semibold leading-none",
        compact ? "h-5 px-1 text-[10px]" : "h-6 px-2.5 text-2xs",
        w.cls,
      )}
    >
      {w.label}
    </span>
  );
}

>>>>>>> d524201 (Fayoum 1 branch performance dashboard)
export function Overview(props: any) {
  return <OverviewView {...props} />;
}

export default OverviewView;
