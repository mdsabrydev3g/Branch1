import { useMemo } from "react";
import {
  formatNumber,
  cumAtDay,
  latestDailyValue,
  calculateTrackTarget,
  calculateDailyTarget,
  calculateRemaining,
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
  vgood: "#34d399",
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
  const branchKpiTargets = usePerfStore((s) => s.branchKpiTargets);
  const branchKpisByPeriod = usePerfStore((s) => s.branchKpisByPeriod);
  const branchDailyActuals = usePerfStore((s) => s.branchDailyActuals);

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
      const enteredTarget =
        branchKpiTargets[period]?.[kpi] ??
        FIXED_KPI_TARGETS[kpi] ??
        branchKpisByPeriod[period]?.[kpi]?.plan ??
        0;

      // Main KPI Actual is driven by the corresponding Daily KPI reading.
      // Use the latest saved cumulative reading for the selected month, including today.
      // This prevents an old manually-entered monthly result from remaining visible.
      const dailyKpi = branchDailyActuals[period]?.[kpi] ?? {};
      const actual = latestDailyValue(dailyKpi);

      const target = kpi === "Gross" && enteredTarget === 0 ? totalDepsTarget : enteredTarget;

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
  }, [deptData, period, branchKpiTargets, branchKpisByPeriod, branchDailyActuals]);

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

  /**
   * صفوف جدول Main KPI: المؤشرات ثم مجموعات المبيعات، بنفس أرقام وحالات العرض
   * السابق حرفياً — المؤشرات تُقاس على Track والمجموعات على مستهدف الشهر.
   */
  const kpiRows = useMemo(
    () => [
      ...TABLE_KPIS.map((kpi) => {
        const d = kpiData[kpi];
        return {
          key: kpi as string,
          label: kpi === "BOXI" ? "Boxi" : kpi,
          target: d.target,
          track: d.track,
          actual: d.actual,
          // Gap is relative to Track: if Actual exceeds Track, show the surplus in green.
          gap: d.actual - d.track,
          gapPositive: d.actual > d.track,
          gapNegative: d.actual < d.track,
          pct: d.achievementRatio,
          tone: perfOf(d.actual, d.track).tone,
        };
      }),
      ...SALES_GROUPS.map((group) => {
        const d = groupData[group.id];
        return {
          key: group.id as string,
          label: group.title,
          target: d.target,
          track: d.track,
          actual: d.actual,
          // Same rule for sales groups: surplus over Track is a positive green gap.
          gap: d.actual - d.track,
          gapPositive: d.actual > d.track,
          gapNegative: d.actual < d.track,
          pct: d.achievementRatio,
          tone: perfOf(d.actual, d.target).tone,
        };
      }),
    ],
    [kpiData, groupData],
  );

  return (
    <div className="flex flex-col gap-2 px-2 pt-0.5 pb-1.5 sm:gap-2.5 sm:px-4 sm:py-2 fade-in">
      {/* Header — العنوان الكبير يساراً، وFayoum 1 Branch + September 2026 تحت بعضهما يميناً */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base">Branch Performance</h1>
        <div className="flex flex-col items-end gap-0 text-right leading-tight">
          <span className="text-xs font-semibold text-foreground sm:text-sm">Fayoum 1 Branch</span>
          <span className="text-[11px] text-subtle sm:text-xs">{periodInfo}</span>
        </div>
      </div>

      {/* Branch Target — الدائرة والإحصائيات بجانبها + كروت CR/GK/Gift */}
      <section className="rounded-2xl bg-card/90 p-3 sm:p-4">
        <h2 className="mb-2 text-base font-semibold text-foreground">Branch Target</h2>

        {/* RTL: الدائرة يميناً + المؤشرات يسارها — نفس التخطيط الأفقي على كل المقاسات بما فيها الموبايل */}
        <div className="flex items-center justify-center gap-3 sm:gap-12 lg:gap-16">
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
          <div className="flex w-full min-w-0 max-w-sm flex-col gap-1.5">
            <StatRow label="Target" value={formatNumber(branchTotal.target)} />
            <StatRow label="Track" value={formatNumber(branchTotal.track)} />
            <StatRow label="Actual" value={formatNumber(branchTotal.actual)} />
            <StatRow label="Remaining" value={formatNumber(Math.max(0, branchTotal.target - branchTotal.actual))} />
            <StatRow label="Daily Target" value={formatNumber(branchTotal.target / daysInMonth)} />
          </div>
        </div>

        {/* CR / GK / Gift — كل بند في صف واحد بعرض الصفحة */}
        <div className="mt-2.5 flex flex-col gap-1.5 sm:mt-3">
          {BRANCH_MINI_KPIS.map((kpi) => {
            const d = kpiData[kpi];
            const tone = perfOf(d.actual, d.target).tone;
            const cardRatio = d.target > 0 ? d.actual / d.target : 0;
            const targetLabel = kpi === "CR" ? `${formatNumber(d.target)}%` : formatNumber(d.target);
            const actualLabel = kpi === "CR" ? `${formatNumber(d.actual)}%` : formatNumber(d.actual);
            return (
              <div
                key={kpi}
                className="grid grid-cols-[minmax(34px,0.6fr)_minmax(48px,1fr)_minmax(48px,1fr)_minmax(30px,0.55fr)_minmax(68px,0.95fr)] items-center gap-1.5 rounded-xl border border-border bg-card-2/50 px-2 py-2 sm:grid-cols-[minmax(64px,0.9fr)_minmax(96px,1.1fr)_minmax(96px,1.1fr)_minmax(60px,0.8fr)_minmax(80px,0.9fr)] sm:gap-3 sm:px-4"
              >
                <span className="justify-self-start text-base font-bold text-foreground sm:text-lg">{kpi === "Gift" ? "Vature" : kpi}</span>
                {/* موبايل: الليبل فوق الرقم (مجموعة متماسكة) فلا يلتصق رقم الـ
                    Target بكلمة Actual. ديسكتوب (sm+): الليبل والرقم متباعدان كالسابق. */}
                <span className="flex min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                  <span className="text-xs text-subtle sm:text-sm">Target</span>
                  <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap text-foreground sm:text-base">{targetLabel}</span>
                </span>
                <span className="flex min-w-0 flex-col items-center gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                  <span className="text-xs text-subtle sm:text-sm">Actual</span>
                  <span className="font-mono text-sm font-semibold tabular-nums whitespace-nowrap text-foreground sm:text-base">{actualLabel}</span>
                </span>
                <span className="flex min-w-0 flex-col items-center justify-self-end gap-0.5">
                  <span className="text-xs text-subtle sm:text-sm">%</span>
                  <span className={cn("text-center font-mono text-sm font-bold tabular-nums sm:text-base", toneTextClass(tone))}>
                    {tone === "none" ? "—" : formatPct1(cardRatio)}
                  </span>
                </span>
                <span className="flex min-w-0 flex-col items-center gap-0.5 sm:items-end">
                  <span className="text-xs text-subtle sm:text-sm">Status</span>
                  <StatusWord tone={tone} compact />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main KPI Performance — كل الأرقام في المنتصف، والجدول يأخذ عرض الصفحة
          كاملاً بلا تمرير أفقي، وعلى الموبايل صفّان لكل مؤشر حتى لا يُقص أي رقم */}
      <section className="rounded-2xl bg-card/90 p-2 sm:p-4">
        <h2 className="mb-2 px-1 text-base font-semibold text-foreground sm:mb-3">Main KPI performance</h2>

        {/* تابلت + ديسكتوب: تخطيط flex لكل صف — KPI ثم Target/Track/Actual/Gap أفقياً،
            ودائرة النسبة المئوية ثابتة في أقصى يمين الصف (نهاية الصف بالكامل) */}
        <div className="hidden sm:flex min-w-0 flex-col overflow-x-hidden">
          {/* Header row */}
          <div className="flex items-center rounded-lg bg-gradient-to-r from-card-3 to-card-2 px-3 py-1.5 shadow-[inset_0_-1px_0_rgba(107,158,255,0.35)]">
            <span className="flex w-[18%] shrink-0 justify-start text-[11px] font-bold uppercase tracking-wide text-foreground">KPI</span>
            <span className="flex w-[14%] shrink-0 justify-center text-[11px] font-bold uppercase tracking-wide text-foreground">Target</span>
            <span className="flex w-[14%] shrink-0 justify-center text-[11px] font-bold uppercase tracking-wide text-foreground">Track</span>
            <span className="flex w-[14%] shrink-0 justify-center text-[11px] font-bold uppercase tracking-wide text-foreground">Actual</span>
            <span className="flex w-[12%] shrink-0 justify-center text-[11px] font-bold uppercase tracking-wide text-foreground">Gap</span>
            <span className="flex flex-1 justify-end text-[11px] font-bold uppercase tracking-wide text-foreground">%</span>
          </div>
          {kpiRows.map((row, i) => (
            <div
              key={row.key}
              className={cn(
                "flex min-w-0 items-center border-b border-border px-3 py-2",
                // صف فاتح وصف أعمق بالتناوب (Zebra) حتى آخر الصفوف
                i % 2 === 0 ? "bg-transparent" : "bg-card-2/60",
              )}
            >
              {/* KPI Content — بداية الصف */}
              <span className="flex w-[18%] min-w-0 shrink-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{row.label}</span>
                <StatusWord tone={row.tone} compact />
              </span>
              {/* Target / Track / Actual / Gap — مرتبة أفقياً ومتوازية */}
              <span className="flex w-[14%] shrink-0 justify-center font-mono text-[13px] tabular-nums whitespace-nowrap text-foreground">
                {formatNumber(row.target)}
              </span>
              <span className="flex w-[14%] shrink-0 justify-center font-mono text-[13px] tabular-nums whitespace-nowrap text-foreground">
                {formatNumber(row.track)}
              </span>
              <span className="flex w-[14%] shrink-0 justify-center font-mono text-[13px] font-semibold tabular-nums whitespace-nowrap text-foreground">
                {formatNumber(row.actual)}
              </span>
              <span className={cn("flex w-[12%] shrink-0 justify-center font-mono text-[13px] font-semibold tabular-nums whitespace-nowrap", toneTextClass(row.tone))}>
                {row.gap > 0 ? `+${formatNumber(row.gap)}` : row.gap < 0 ? `-${formatNumber(Math.abs(row.gap))}` : "0"}
              </span>
              {/* دائرة النسبة المئوية — ثابتة في نهاية الصف بالكامل، بنفس الحجم والمحاذاة لكل الصفوف */}
              <span className="flex flex-1 items-center justify-end pl-2">
                <ProgressRing ratio={row.pct} tone={row.tone} sizeClass="size-14" textClass="text-[14px]" />
              </span>
            </div>
          ))}
        </div>

        {/* موبايل: المحتوى يساراً (الاسم والحالة ثم Target/Track/Actual/Gap)
            ودائرة النسبة مستقلة في أقصى يمين الكارت متمركزة رأسياً على ارتفاع الصف كله */}
        <div className="flex flex-col gap-1.5 sm:hidden">
          {kpiRows.map((row, i) => (
            <div
              key={row.key}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-xl border border-border/70 px-3 py-2",
                // نفس سلسلة التناوب على الموبايل
                i % 2 === 0 ? "bg-card-2/40" : "bg-card-3/60",
              )}
            >
              {/* محتوى الصف — مزاح لليسار */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{row.label}</span>
                  <StatusWord tone={row.tone} compact />
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                  <KpiMini label="Target" value={formatNumber(row.target)} />
                  <KpiMini label="Track" value={formatNumber(row.track)} />
                  <KpiMini label="Actual" value={formatNumber(row.actual)} bold />
                  <KpiMini
                    label="Gap"
                    value={row.gap > 0 ? `+${formatNumber(row.gap)}` : row.gap < 0 ? `-${formatNumber(Math.abs(row.gap))}` : "0"}
                    tone={row.gapPositive ? "good" : row.gapNegative ? "danger" : "none"}
                    bold
                  />
                </div>
              </div>
              {/* دائرة النسبة — مستقلة في نهاية الصف بالكامل بنفس الحجم والمحاذاة */}
              <div className="flex shrink-0 items-center justify-end">
                <ProgressRing ratio={row.pct} tone={row.tone} sizeClass="size-14" textClass="text-[14px]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer credit */}
      <footer className="mt-1 border-t border-border pt-3 text-center">
        <p className="text-xs font-medium text-subtle">Created By Mohamed Sabry</p>
        <p className="text-2xs text-subtle">Sep 2026</p>
      </footer>
    </div>
  );
}

/** خلية رأس الجدول — منتصفة وبنفس الهوية في كل الأعمدة */
function headCell(extra = "") {
  return cn(
    "border-r border-border/70 px-3 py-1.5 align-middle text-center text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-foreground",
    extra,
  );
}

/**
 * خلية رقم في الجدول — منتصفة مع `tabular-nums`.
 * بلا `overflow-hidden` (كما كان سابقاً) حتى لا يُقتطع أي رقم بهدوء.
 */
function numCell(bold = false) {
  return cn(
    "border-r border-border/70 px-3 py-1.5 align-middle text-center font-mono text-[13px] tabular-nums whitespace-nowrap text-foreground",
    bold && "font-semibold",
  );
}

/** خلية مصغّرة في تخطيط الموبايل: التسمية يساراً والقيمة يميناً بلا قصّ */
function KpiMini({
  label,
  value,
  tone,
  bold = false,
}: {
  label: string;
  value: string;
  tone?: PerfTone;
  bold?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="text-2xs tracking-wide text-subtle uppercase">{label}</span>
      <span
        className={cn(
          "font-mono text-xs tabular-nums whitespace-nowrap",
          bold && "font-semibold",
          tone ? toneTextClass(tone) : "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

/**
 * حلقة تقدم صغيرة لصف KPI — نفس أسلوب دائرة Branch Target (SVG ring، نفس
 * الألوان والـ tone). النسبة تُعرض داخل المركز فقط — لا توجد نسبة نصية أخرى.
 */
function ProgressRing({
  ratio,
  tone,
  sizeClass = "size-8",
  textClass = "text-[10px]",
}: {
  ratio: number;
  tone: PerfTone;
  sizeClass?: string;
  textClass?: string;
}) {
  const R = 15.5;
  const C = 2 * Math.PI * R; // ≈ 97.39
  const fill = C * Math.max(0, Math.min(1, ratio));
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", sizeClass)}
      role="img"
      aria-label={formatPct0(ratio)}
    >
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="none" stroke="var(--color-card-3, #1e293b)" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r={R}
          fill="none"
          stroke={CIRCLE_STROKE[tone]}
          strokeWidth="4"
          strokeDasharray={`${fill} ${C}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center font-mono font-bold tabular-nums",
          textClass,
          toneTextClass(tone),
        )}
      >
        {formatPct0(ratio)}
      </span>
    </span>
  );
}

/** نسبة صحيحة بلا كسور (عرض فقط — الحسابات الداخلية تبقى بدقتها الكاملة) */
export function formatPct0(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card-2/50 px-3 py-1.5 sm:gap-4 sm:px-4 sm:py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/** كلمة الحالة بنفس نظام الأقسام: Excellent / Good / Will Do / Danger */
function StatusWord({ tone, compact = false }: { tone: PerfTone; compact?: boolean }) {
  const WORD: Record<PerfTone, { label: string; cls: string }> = {
    vgood: { label: "V.Good", cls: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" },
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
        "inline-flex items-center self-center whitespace-nowrap rounded-md border font-semibold leading-none",
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
