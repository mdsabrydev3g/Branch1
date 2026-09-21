import { useMemo } from "react";
import { formatNumber, getDaysInMonth, getTrackDay, periodMeta } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { HALF1_DAYS, Section, buildRows, computeStats } from "@/components/sales-common";
import type { Dep } from "@/lib/domain";

/**
 * لوحة مجموعة مبيعات بمستويات: الإجمالي أولاً (الأبرز) ثم كل قسم لوحده.
 * تُستخدم لـ TV — AC و MDA - SDA. للعرض فقط — الإدخال من Daily Editor.
 */
export function GroupLevelsDashboard({
  pageLabel,
  deps,
  groupId,
  totalTitle,
}: {
  pageLabel: string;
  deps: [Dep, Dep];
  groupId: "tv-ac" | "mda-sda";
  totalTitle: string;
}) {
  const period = usePerfStore((s) => s.period);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);

  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period);
  const half2Visible = trackDay >= HALF1_DAYS;
  const meta = periodMeta(period);

  const [depA, depB] = deps;
  const targetA = departmentTargets[period]?.[depA] ?? 0;
  const targetB = departmentTargets[period]?.[depB] ?? 0;
  const dailyA = departmentDailyActuals[period]?.[depA] ?? {};
  const dailyB = departmentDailyActuals[period]?.[depB] ?? {};

  // دمج قراءات القسمين لكل تاريخ (القيم تراكمية لكل قسم — الجمع يعطي إجمالي تراكمي)
  const mergedDaily = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const d of new Set([...Object.keys(dailyA), ...Object.keys(dailyB)])) {
      merged[d] = (Number(dailyA[d]) || 0) + (Number(dailyB[d]) || 0);
    }
    return merged;
  }, [dailyA, dailyB]);

  const totalS = useMemo(
    () => computeStats(mergedDaily, targetA + targetB, daysInMonth, trackDay),
    [mergedDaily, targetA, targetB, daysInMonth, trackDay],
  );
  const aS = useMemo(
    () => computeStats(dailyA, targetA, daysInMonth, trackDay),
    [dailyA, targetA, daysInMonth, trackDay],
  );
  const bS = useMemo(
    () => computeStats(dailyB, targetB, daysInMonth, trackDay),
    [dailyB, targetB, daysInMonth, trackDay],
  );

  const totalRows = useMemo(() => buildRows(mergedDaily, totalS.dailyTarget), [mergedDaily, totalS.dailyTarget]);
  const aRows = useMemo(() => buildRows(dailyA, aS.dailyTarget), [dailyA, aS.dailyTarget]);
  const bRows = useMemo(() => buildRows(dailyB, bS.dailyTarget), [dailyB, bS.dailyTarget]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-4 sm:px-4 fade-in">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-foreground">{pageLabel}</h1>
        <p className="mt-1 text-sm text-subtle">
          {meta.label} · Day {trackDay} of {daysInMonth}
        </p>
      </div>

      {/* 1 — الإجمالي (الأبرز) */}
      <Section
        title={totalTitle}
        s={totalS}
        rows={totalRows}
        daysInMonth={daysInMonth}
        half2Visible={half2Visible}
        highlight
      />

      {/* 2 و 3 — كل قسم لوحده */}
      <Section
        title={depA}
        subtitle={`Monthly Target ${formatNumber(targetA)}`}
        s={aS}
        rows={aRows}
        daysInMonth={daysInMonth}
        half2Visible={half2Visible}
      />
      <Section
        title={depB}
        subtitle={`Monthly Target ${formatNumber(targetB)}`}
        s={bS}
        rows={bRows}
        daysInMonth={daysInMonth}
        half2Visible={half2Visible}
      />
    </div>
  );
}
