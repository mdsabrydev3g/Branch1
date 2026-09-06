import { useMemo } from "react";
import {
  formatNumber,
  formatPct,
  getDaysInMonth,
  ratio,
  sumBlock,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { ProgressBar } from "@/components/progress-bar";
import { StatusPill } from "@/components/status-pill";

export function DepartmentView({ depKey }: { depKey: string }) {
  const data = usePerfStore((s) => s.data);
  const period = usePerfStore((s) => s.period);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);

  const today = new Date().toISOString().slice(0, 10);
  const currentDay = new Date().getDate();
  const currentMonthPeriod = today.slice(0, 7);

  const block = data[period] || {};

  // 1. حساب المستهدف الأصلي
  const fallback = sumBlock(block[depKey]);
  const monthTarget = departmentTargets[period]?.[depKey] ?? fallback.plan;

  // 2. المحقق اليومي
  const dailyData = departmentDailyActuals[period]?.[depKey] || {};

  const { firstHalfActual, secondHalfActual } = useMemo(() => {
    let maxFirstHalf = 0;
    let maxSecondHalf = 0;

    Object.entries(dailyData).forEach(([dateStr, val]) => {
      const dayNum = parseInt(dateStr.slice(-2), 10);
      const numVal = Number(val) || 0;
      if (dayNum <= 15) {
        if (numVal > maxFirstHalf) maxFirstHalf = numVal;
      } else {
        if (numVal > maxSecondHalf) maxSecondHalf = numVal;
      }
    });

    const actualFirst = maxFirstHalf > 0 ? maxFirstHalf : fallback.result;
    const actualSecond = maxSecondHalf;

    return {
      firstHalfActual: actualFirst,
      secondHalfActual: actualSecond,
    };
  }, [dailyData, fallback.result]);

  // 3. مستهدف الأجزاء
  const daysInMonth = getDaysInMonth(period);
  const firstHalfTarget = Math.round((monthTarget / daysInMonth) * 15);
  const checkpoint80Target = Math.round(firstHalfTarget * 0.8);
  const secondHalfTarget = monthTarget - firstHalfTarget;

  const firstHalfRatio = ratio({ plan: firstHalfTarget, result: firstHalfActual });
  const checkpointRatio = ratio({ plan: checkpoint80Target, result: firstHalfActual });
  const secondHalfRatio = ratio({ plan: secondHalfTarget, result: secondHalfActual });

  const showSecondHalf = currentDay >= 16 || period < currentMonthPeriod;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-1 sm:px-4">
      {/* First 15 days Card */}
      <section className="hairline print-surface rounded-2xl bg-card/80 p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">First 15 days</h2>
            <p className="text-xs text-subtle">Day 1 to Day 15</p>
          </div>
          <StatusPill ratio={firstHalfRatio} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-2xs uppercase text-subtle">Target</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(firstHalfTarget)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Actual</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(firstHalfActual)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Remaining</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(Math.max(0, firstHalfTarget - firstHalfActual))}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-subtle">
            <span>Achievement</span>
            <span>{formatPct(firstHalfRatio)}</span>
          </div>
          <ProgressBar value={firstHalfRatio} />
        </div>
      </section>

      {/* First-half 80% checkpoint Card */}
      <section className="hairline print-surface rounded-2xl bg-card/80 p-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">First-half 80% checkpoint</h2>
            <p className="text-xs text-subtle">80% of the first 15-day target</p>
          </div>
          <StatusPill ratio={checkpointRatio} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-2xs uppercase text-subtle">Target</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(checkpoint80Target)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Actual</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(firstHalfActual)}
            </p>
          </div>
          <div>
            <span className="text-2xs uppercase text-subtle">Remaining</span>
            <p className="font-mono text-base font-semibold text-foreground">
              {formatNumber(Math.max(0, checkpoint80Target - firstHalfActual))}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-subtle">
            <span>Achievement</span>
            <span>{formatPct(checkpointRatio)}</span>
          </div>
          <ProgressBar value={checkpointRatio} />
        </div>
      </section>

      {/* Second half Card */}
      {showSecondHalf && (
        <section className="hairline print-surface rounded-2xl bg-card/80 p-5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-foreground">Second half</h2>
              <p className="text-xs text-subtle">Day 16 to Day 30</p>
            </div>
            <StatusPill ratio={secondHalfRatio} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-2xs uppercase text-subtle">Target</span>
              <p className="font-mono text-base font-semibold text-foreground">
                {formatNumber(secondHalfTarget)}
              </p>
            </div>
            <div>
              <span className="text-2xs uppercase text-subtle">Actual</span>
              <p className="font-mono text-base font-semibold text-foreground">
                {formatNumber(secondHalfActual)}
              </p>
            </div>
            <div>
              <span className="text-2xs uppercase text-subtle">Remaining</span>
              <p className="font-mono text-base font-semibold text-foreground">
                {formatNumber(Math.max(0, secondHalfTarget - secondHalfActual))}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-subtle">
              <span>Achievement</span>
              <span>{formatPct(secondHalfRatio)}</span>
            </div>
            <ProgressBar value={secondHalfRatio} />
          </div>
        </section>
      )}
    </div>
  );
}

export function DepartmentGroupView(props: { depKey: string }) {
  return <DepartmentView {...props} />;
}
