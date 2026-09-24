import { useMemo, useState } from "react";
import { DEP_SHORT, dailyDiffAt, formatNumber, getDaysInMonth, getTrackDay, periodMeta } from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { HALF1_DAYS, Metric, PerfPill, Section, buildRows, computeStats, formatPct1, toneTextClass } from "@/components/sales-common";
import type { Dep } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * لوحة مجموعة مبيعات بمستويات: الإجمالي أولاً (الأبرز) ثم كل قسم لوحده.
 * تُستخدم لـ TV-AC و MDA-SDA. للعرض فقط — الإدخال من Daily Editor.
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
      >
        <GroupedDailyDetails
          rows={totalRows.map((r) => ({
            ...r,
            perDep: deps.map((dep) => ({
              dep,
              daily: dailyDiffAt(departmentDailyActuals[period]?.[dep] ?? {}, r.date),
            })),
          }))}
          daysInMonth={daysInMonth}
        />
      </Section>

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

function GroupedDailyDetails({
  rows,
  daysInMonth,
}: {
  rows: Array<ReturnType<typeof buildRows>[number] & {
    perDep: { dep: Dep; daily: number }[];
  }>;
  daysInMonth: number;
}) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="rounded-xl bg-card-2/40 p-4 text-center text-xs text-subtle">لا توجد إدخالات بعد — أضف محقق اليوم من صفحة Daily Editor.</p>;
  }

  return (
    <>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left">
          <thead><tr className="border-b border-border text-2xs uppercase tracking-wider text-subtle">
            <th className="w-[16%] py-2 pr-2 font-semibold">Date</th>
            <th className="w-[22%] px-1 py-2 text-right font-semibold">Daily</th>
            <th className="w-[18%] px-1 py-2 text-right font-semibold">%</th>
            <th className="w-[34%] px-1 py-2 text-right font-semibold">Status</th>
            <th className="w-[10%] py-2 text-right font-semibold"></th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const open = openDate === r.date;
              return <tr key={r.date} className="text-xs"><td colSpan={5} className="p-0">
                <button type="button" onClick={() => setOpenDate(open ? null : r.date)} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-card-2/30">
                  <span className="w-[16%] font-mono tabular-nums text-muted">{r.date.slice(5)}</span>
                  <span className="w-[22%] text-right font-mono tabular-nums text-foreground">{formatNumber(r.dailyActual)}</span>
                  <span className={cn("w-[18%] text-right font-mono font-semibold tabular-nums", toneTextClass(r.tone))}>{r.tone === "none" ? "—" : formatPct1(r.pct)}</span>
                  <span className="flex w-[34%] items-center justify-end gap-2"><PerfPill tone={r.tone} compact /></span>
                  <span className="w-[10%] text-right text-xs text-subtle">{open ? "−" : "+"}</span>
                </button>
                {open && <div className="grid grid-cols-2 gap-2 border-t border-border bg-card-2/20 px-2 py-2 sm:grid-cols-4">
                  {r.perDep.map((p) => <Metric label={DEP_SHORT[p.dep]} value={formatNumber(p.daily)} key={p.dep} />)}
                  <Metric label="Day Total" value={formatNumber(r.dailyActual)} />
                  <Metric label="Cumulative" value={formatNumber(r.cumulative)} />
                  <Metric label="Track" value={formatNumber(r.track)} />
                  <Metric label="Status" value={r.tone === "none" ? "—" : r.tone === "excellent" ? "Excellent" : r.tone === "vgood" ? "V.Good" : r.tone === "good" ? "Good" : r.tone === "willdo" ? "Will Do" : "Danger"} />
                </div>}
              </td></tr>;
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const open = openDate === r.date;
          return <div key={r.date} className="overflow-hidden rounded-xl border border-border bg-card-2/40">
            <button type="button" onClick={() => setOpenDate(open ? null : r.date)} className="flex w-full items-center gap-2 p-3 text-left" aria-expanded={open}>
              <span className="min-w-0 flex-1 font-mono text-xs font-semibold tabular-nums text-foreground">{r.date}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{formatNumber(r.dailyActual)}</span>
              <span className={cn("font-mono text-xs font-semibold tabular-nums", toneTextClass(r.tone))}>{r.tone === "none" ? "—" : formatPct1(r.pct)}</span>
              <span className="text-xs text-subtle">{open ? "−" : "+"}</span>
            </button>
            {open && <div className="grid grid-cols-2 gap-1.5 border-t border-border p-3">
              {r.perDep.map((p) => <Metric label={DEP_SHORT[p.dep]} value={formatNumber(p.daily)} key={p.dep} />)}
              <Metric label="Day Total" value={formatNumber(r.dailyActual)} />
              <Metric label="Cumulative" value={formatNumber(r.cumulative)} />
              <Metric label="Track" value={formatNumber(r.track)} />
              <Metric label="Status" value={r.tone === "none" ? "—" : r.tone === "excellent" ? "Excellent" : r.tone === "vgood" ? "V.Good" : r.tone === "good" ? "Good" : r.tone === "willdo" ? "Will Do" : "Danger"} />
            </div>}
          </div>;
        })}
      </div>
    </>
  );
}
