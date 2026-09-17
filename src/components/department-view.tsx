import { useMemo } from "react";
import {
  formatNumber,
  formatPct,
  getDaysInMonth,
  ratio,
  sumBlock,
  latestDailyValue,
  firstHalfActualFromDaily,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";

export function DepartmentGroupView({ title, deps }: { title: string; deps: string[] }) {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);

  const today = new Date().toISOString().slice(0, 10);
  const currentDay = new Date().getDate();
  const currentMonthPeriod = today.slice(0, 7);
  const block = data[period] ?? {};

  // 1. حساب المستهدف الإجمالي لكافة أقسام المجموعة معاً
  const monthTarget = useMemo(() => {
    return deps.reduce((sum, dep) => {
      const depKey = dep as Dep;
      const fallback = block[depKey] ? sumBlock(block[depKey]) : { plan: 0, result: 0 };
      const target = departmentTargets[period]?.[depKey] ?? fallback.plan;
      return sum + target;
    }, 0);
  }, [deps, block, departmentTargets, period]);

  // 2. حساب المحقق التراكمي للنصف الأول والنصف الثاني لجميع أقسام المجموعة
  const { firstHalfActual, secondHalfActual, totalMonthActual } = useMemo(() => {
    let firstHalfSum = 0;
    let monthActualSum = 0;

    deps.forEach((dep) => {
      const depKey = dep as Dep;
      const fallback = block[depKey] ? sumBlock(block[depKey]) : { plan: 0, result: 0 };
      const daily = departmentDailyActuals[period]?.[depKey] ?? {};

      const latestVal = latestDailyValue(daily);
      const hasDaily = Object.keys(daily).length > 0;

      const depMonthActual = hasDaily ? latestVal : fallback.result;
      const depFirstHalf = hasDaily
        ? firstHalfActualFromDaily(daily)
        : Math.min(depMonthActual, Math.round(depMonthActual * 0.5));

      firstHalfSum += depFirstHalf;
      monthActualSum += depMonthActual;
    });

    const secondHalf = Math.max(0, monthActualSum - firstHalfSum);

    return {
      firstHalfActual: firstHalfSum,
      secondHalfActual: secondHalf,
      totalMonthActual: monthActualSum,
    };
  }, [deps, block, departmentDailyActuals, period]);

  // 3. حساب مستهدف الأجزاء
  const daysInMonth = getDaysInMonth(period);
  const firstHalfTarget = Math.round((monthTarget / daysInMonth) * 15);
  const checkpoint80Target = Math.round(firstHalfTarget * 0.8);
  const secondHalfTarget = Math.max(0, monthTarget - firstHalfTarget);

  // النسب المئوية للمستهدفات
  const firstHalfRatio = ratio({ plan: firstHalfTarget, result: firstHalfActual });
  const checkpointRatio = ratio({ plan: checkpoint80Target, result: firstHalfActual });
  const secondHalfRatio = ratio({ plan: secondHalfTarget, result: secondHalfActual });
  const totalRatio = ratio({ plan: monthTarget, result: totalMonthActual });

  // شرط عرض كارت النصف الثاني (من يوم 16 في الشهر الحالي أو عند عرض أشهر سابقة)
  const showSecondHalf = currentDay >= 16 || period < currentMonthPeriod;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-1 sm:px-4 fade-in">
      {/* Header */}
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-subtle">Combined performance for {deps.join(" + ")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-subtle">Total Month Achievement</div>
            <div className="font-mono text-lg font-bold text-foreground">
              {formatPct(totalRatio)}
            </div>
          </div>
          <StatusPill ratio={totalRatio} />
        </div>
      </div>

      {/* 1. First 15 days Card */}
      <section className="hairline print-surface gradient-border rounded-2xl bg-card/90 p-6 card-hover">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">First 15 days</h2>
            <p className="text-xs text-subtle">Day 1 to Day 15</p>
          </div>
          <StatusPill ratio={firstHalfRatio} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-card-2/50 p-4">
            <span className="text-2xs uppercase tracking-wider text-subtle">Target</span>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatNumber(firstHalfTarget)}
            </p>
          </div>
          <div className="rounded-xl bg-card-2/50 p-4">
            <span className="text-2xs uppercase tracking-wider text-subtle">Actual</span>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatNumber(firstHalfActual)}
            </p>
          </div>
          <div className="rounded-xl bg-card-2/50 p-4">
            <span className="text-2xs uppercase tracking-wider text-subtle">Remaining</span>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatNumber(Math.max(0, firstHalfTarget - firstHalfActual))}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs text-subtle">
            <span className="font-medium">Achievement</span>
            <span className="font-semibold text-foreground">{formatPct(firstHalfRatio)}</span>
          </div>
          <ProgressBar value={firstHalfRatio} />
        </div>
      </section>

      {/* 2. First-half 80% checkpoint Card */}
      <section className="hairline print-surface gradient-border rounded-2xl bg-card/90 p-6 card-hover">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">First-half 80% checkpoint</h2>
            <p className="text-xs text-subtle">80% of the first 15-day target</p>
          </div>
          <StatusPill ratio={checkpointRatio} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-card-2/50 p-4">
            <span className="text-2xs uppercase tracking-wider text-subtle">Target</span>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatNumber(checkpoint80Target)}
            </p>
          </div>
          <div className="rounded-xl bg-card-2/50 p-4">
            <span className="text-2xs uppercase tracking-wider text-subtle">Actual</span>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatNumber(firstHalfActual)}
            </p>
          </div>
          <div className="rounded-xl bg-card-2/50 p-4">
            <span className="text-2xs uppercase tracking-wider text-subtle">Remaining</span>
            <p className="font-mono text-lg font-bold text-foreground">
              {formatNumber(Math.max(0, checkpoint80Target - firstHalfActual))}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs text-subtle">
            <span className="font-medium">Achievement</span>
            <span className="font-semibold text-foreground">{formatPct(checkpointRatio)}</span>
          </div>
          <ProgressBar value={checkpointRatio} />
        </div>
      </section>

      {/* 3. Second half Card - يظهر من يوم 16 فقط */}
      {showSecondHalf && (
        <section className="hairline print-surface gradient-border rounded-2xl bg-card/90 p-6 card-hover">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Second half</h2>
              <p className="text-xs text-subtle">Day 16 to Day {daysInMonth}</p>
            </div>
            <StatusPill ratio={secondHalfRatio} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl bg-card-2/50 p-4">
              <span className="text-2xs uppercase tracking-wider text-subtle">Target</span>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatNumber(secondHalfTarget)}
              </p>
            </div>
            <div className="rounded-xl bg-card-2/50 p-4">
              <span className="text-2xs uppercase tracking-wider text-subtle">Actual</span>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatNumber(secondHalfActual)}
              </p>
            </div>
            <div className="rounded-xl bg-card-2/50 p-4">
              <span className="text-2xs uppercase tracking-wider text-subtle">Remaining</span>
              <p className="font-mono text-lg font-bold text-foreground">
                {formatNumber(Math.max(0, secondHalfTarget - secondHalfActual))}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs text-subtle">
              <span className="font-medium">Achievement</span>
              <span className="font-semibold text-foreground">{formatPct(secondHalfRatio)}</span>
            </div>
            <ProgressBar value={secondHalfRatio} />
          </div>
        </section>
      )}
    </div>
  );
}
