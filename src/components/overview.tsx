import { useMemo } from "react";
import {
  formatNumber,
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
  type Kpi,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  perfOf,
  toneTextClass,
  formatPct1,
  type PerfTone,
} from "@/components/sales-common";

// Helper function for ratio calculation
function calculateRatio(plan: number, result: number): number {
  if (!plan) return result > 0 ? 1 : 0;
  return result / plan;
}

const CIRCLE_STROKE: Record<PerfTone, string> = {
  excellent: "#10b981",
  good: "#10b981",
  willdo: "#f59e0b",
  danger: "#ef4444",
  none: "#475569",
};

export function OverviewView() {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);
  const branchKpiTargets = usePerfStore((s) => s.branchKpiTargets);
  const branchKpis = usePerfStore((s) => s.branchKpis);

  const block = data[period] || {};
  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period);

  // حساب القيم لكل قسم — القيم المخزّنة قراءات تراكمية: المحقق = آخر قراءة حتى الأمس
  const deptData = useMemo(() => {
    const result: Record<
      Dep,
      { target: number; actual: number; track: number; dailyTarget: number }
    > = {} as any;

    DEPS.forEach((dep) => {
      const fallback = sumBlock(block[dep]);
      const daily = departmentDailyActuals[period]?.[dep] ?? {};
      const monthlyTarget = departmentTargets[period]?.[dep] ?? fallback.plan;
      const actual = Object.keys(daily).length > 0 ? cumAtDay(daily, trackDay) : fallback.result;

      result[dep] = {
        target: monthlyTarget,
        actual,
        track: calculateTrackTarget(monthlyTarget, period),
        dailyTarget: calculateDailyTarget(monthlyTarget, period),
      };
    });

    return result;
  }, [block, period, departmentDailyActuals, departmentTargets, trackDay]);

  // حساب القيم لكل KPI — قراءة تراكمية (CR نسبة شهرية: القراءة نفسها)
  const kpiData = useMemo(() => {
    const result: Record<
      Kpi,
      { target: number; actual: number; track: number; dailyTarget: number; achievementRatio: number }
    > = {} as any;

    const totalDepsTarget = DEPS.reduce((sum, dep) => sum + (deptData[dep]?.target || 0), 0);
    const totalDepsActual = DEPS.reduce((sum, dep) => sum + (deptData[dep]?.actual || 0), 0);

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
  }, [deptData, period, branchDailyActuals, branchKpiTargets, branchKpis, trackDay]);

  // حساب القيم لمجموعات الأقسام
  const groupData = useMemo(() => {
    const result: Record<string, { target: number; actual: number; track: number; achievementRatio: number }> = {};

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

      result[group.id] = {
        target,
        actual,
        track: calculateTrackTarget(target, period),
        // نسبة القسم = المحقق ÷ مستهدف الشهر الكلي
        achievementRatio: calculateRatio(target, actual),
      };
    });

    return result;
  }, [deptData, period]);

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

  const periodInfo = useMemo(() => {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const [year, month] = period.split("-").map(Number);
    return `${monthNames[month - 1]} ${year}`;
  }, [period]);

  return (
    <div className="flex flex-col gap-5 px-2 py-5 sm:px-4 fade-in">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-xl font-bold uppercase tracking-wider text-foreground">Branch Performance</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base font-semibold text-foreground">Fayoum 1 Branch</span>
          <span className="text-sm text-subtle">{periodInfo}</span>
        </div>
      </div>

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
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  fill="none"
                  stroke={CIRCLE_STROKE[branchTone]}
                  strokeWidth="10"
                  strokeDasharray={`${Math.min(339.292, 339.292 * Math.max(0, branchTotal.achievementRatio))} 339.292`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className={cn("font-mono text-2xl font-bold tabular-nums sm:text-3xl", toneTextClass(branchTone))}>
                  {formatPct1(branchTotal.achievementRatio)}
                </div>
              </div>
            </div>
            <StatusWord tone={branchTone} />
          </div>

          {/* Stats — يسار الدائرة مباشرة */}
          <div className="flex w-full max-w-sm flex-col gap-2">
            <StatRow label="Target" value={formatNumber(branchTotal.target)} />
            <StatRow label="Track" value={formatNumber(branchTotal.track)} />
            <StatRow label="Actual" value={formatNumber(branchTotal.actual)} />
            <StatRow label="Remaining" value={formatNumber(Math.max(0, branchTotal.target - branchTotal.actual))} />
            <StatRow label="Daily Target" value={formatNumber(branchTotal.target / daysInMonth)} />
          </div>
        </div>

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

      {/* Main KPI Performance — جدول احترافي: فواصل أعمدة + محاذاة أرقام + مساحات مريحة */}
      <section className="rounded-2xl bg-card/90 p-3 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Main KPI performance</h2>

        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-card-3 to-card-2 shadow-[inset_0_-1px_0_rgba(107,158,255,0.35)]">
              <th className="w-[17%] border-r border-border/70 px-0.5 py-2.5 text-left text-[9.5px] font-bold uppercase tracking-wide text-foreground sm:w-[21%] sm:px-4 sm:py-3 sm:text-xs">KPI</th>
              <th className="w-[19%] border-r border-border/70 px-1 py-2.5 text-right text-[9px] font-bold uppercase tracking-wide text-foreground sm:w-[18%] sm:px-4 sm:py-3 sm:text-xs">Target</th>
              <th className="w-[19%] border-r border-border/70 px-1 py-2.5 text-right text-[9px] font-bold uppercase tracking-wide text-foreground sm:w-[18%] sm:px-4 sm:py-3 sm:text-xs">Track</th>
              <th className="w-[19%] border-r border-border/70 px-1 py-2.5 text-right text-[9px] font-bold uppercase tracking-wide text-foreground sm:w-[18%] sm:px-4 sm:py-3 sm:text-xs">Actual</th>
              <th className="w-[8%] border-r border-border/70 px-0.5 py-2.5 text-right text-[9px] font-bold uppercase tracking-wide text-foreground sm:w-[11%] sm:px-4 sm:py-3 sm:text-xs">%</th>
              <th className="w-[18%] px-0.5 py-2.5 text-center text-[9px] font-bold uppercase tracking-wide text-foreground sm:w-[14%] sm:px-4 sm:py-3 sm:text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_KPIS.map((kpi) => {
              const d = kpiData[kpi];
              const tone = perfOf(d.actual, d.track).tone;
              return (
                <tr key={kpi} className="border-b border-border">
                  <td className="whitespace-nowrap border-r border-border/70 px-0.5 py-2.5 text-left text-[9.5px] font-semibold text-foreground sm:px-4 sm:py-3.5 sm:text-sm">
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
                  <td className="px-0.5 py-2.5 text-center sm:px-4 sm:py-3.5">
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
                  <td className="whitespace-nowrap border-r border-border/70 px-0.5 py-2.5 text-left text-[9.5px] font-semibold text-foreground sm:px-4 sm:py-3.5 sm:text-sm">
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
                  <td className="px-0.5 py-2.5 text-center sm:px-4 sm:py-3.5">
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
    </div>
  );
}

function numCell(bold = false) {
  return cn(
    "whitespace-nowrap border-r border-border/70 px-0.5 py-2.5 text-right font-mono text-[9.5px] tabular-nums text-foreground sm:px-4 sm:py-3.5 sm:text-sm",
    bold && "font-semibold",
  );
}

/** نسبة صحيحة بلا كسور (عرض فقط — الحسابات الداخلية تبقى بدقتها الكاملة) */
export function formatPct0(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-card-2/50 px-4 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

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

export function Overview(props: any) {
  return <OverviewView {...props} />;
}

export default OverviewView;
