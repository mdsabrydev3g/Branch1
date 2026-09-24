import { useMemo, useState } from "react";
import {
  DEP_SHORT,
  dailyDiffAt,
  formatNumber,
  getDaysInMonth,
  getTrackDay,
  periodMeta,
  type Dep,
} from "@/lib/domain";
import { usePerfStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  HALF1_DAYS,
  Section,
  buildRows,
  computeStats,
  formatPct1,
  PerfPill,
  Metric,
  toneTextClass,
  type PerfTone,
} from "@/components/sales-common";

/**
 * صفحة Mobile: قسم متكامل — الأربعة أجزاء معاً في جدول واحد:
 * Mobile + Laptop + Other + ACC
 * للعرض فقط — الإدخال من صفحة Daily Editor.
 */
const MOBILE_DEPS: Dep[] = ["Mobile", "Laptop", "Other", "ACC"];

export function MobileGroupView() {
  const period = usePerfStore((s) => s.period);
  const departmentTargets = usePerfStore((s) => s.departmentTargets);
  const departmentDailyActuals = usePerfStore((s) => s.departmentDailyActuals);

  const daysInMonth = getDaysInMonth(period);
  const trackDay = getTrackDay(period);
  const half2Visible = trackDay >= HALF1_DAYS;
  const meta = periodMeta(period);

  const depTargets = useMemo(
    () =>
      MOBILE_DEPS.map((dep) => ({
        dep,
        target: departmentTargets[period]?.[dep] ?? 0,
        daily: departmentDailyActuals[period]?.[dep] ?? {},
      })),
    [departmentTargets, departmentDailyActuals, period],
  );

  const totalTarget = depTargets.reduce((sum, d) => sum + d.target, 0);

  // دمج القراءات التراكمية للأجزاء الأربعة لكل تاريخ
  const mergedDaily = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const { daily } of depTargets) {
      for (const [date, value] of Object.entries(daily)) {
        merged[date] = (merged[date] || 0) + (Number(value) || 0);
      }
    }
    return merged;
  }, [depTargets]);

  const totalS = useMemo(
    () => computeStats(mergedDaily, totalTarget, daysInMonth, trackDay),
    [mergedDaily, totalTarget, daysInMonth, trackDay],
  );
  const totalRows = useMemo(() => buildRows(mergedDaily, totalS.dailyTarget), [mergedDaily, totalS.dailyTarget]);

  // صف موحّد لكل تاريخ: مبيعات اليوم لكل جزء + إجمالي اليوم + التراكمي
  const multiRows = useMemo(() => {
    return totalRows.map((r) => ({
      ...r,
      perDep: MOBILE_DEPS.map((dep) => {
        const daily = departmentDailyActuals[period]?.[dep] ?? {};
        return { dep, daily: dailyDiffAt(daily, r.date) };
      }),
    }));
  }, [totalRows, departmentDailyActuals, period]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-4 sm:px-4 fade-in">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-foreground">Mobile</h1>
        <p className="mt-1 text-sm text-subtle">
          {meta.label} · Day {trackDay} of {daysInMonth}
        </p>
      </div>

      {/* القسم الواحد المجمّع للأجزاء الأربعة */}
      <Section
        title="Mobile Group"
        s={totalS}
        rows={totalRows}
        daysInMonth={daysInMonth}
        half2Visible={half2Visible}
        highlight
      >
        <MultiDepDetails rows={multiRows} daysInMonth={daysInMonth} />
      </Section>
    </div>
  );
}

/* جدول موحّد: الأجزاء الأربعة معاً في كل صف تاريخ */
function MultiDepDetails({
  rows,
  daysInMonth,
}: {
  rows: {
    date: string;
    day: number;
    half: "H1" | "H2";
    dailyActual: number;
    cumulative: number;
    track: number;
    pct: number;
    tone: PerfTone;
    perDep: { dep: Dep; daily: number }[];
  }[];
  daysInMonth: number;
}) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  const halfLabel = (h: "H1" | "H2") =>
    h === "H1"
      ? `Half 1 — Days 1-${HALF1_DAYS}`
      : `Half 2 — Days ${HALF1_DAYS + 1}-${daysInMonth}`;

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-card-2/40 p-4 text-center text-xs text-subtle">
        لا توجد إدخالات بعد — أضف محقق اليوم من صفحة Daily Editor.
      </p>
    );
  }

  return (
    <>
      {/* Desktop / Tablet — Accordion per day */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wider text-subtle">
              <th className="w-[16%] py-2 pr-2 font-semibold">Date</th>
              <th className="w-[22%] px-1 py-2 text-right font-semibold">Daily</th>
              <th className="w-[18%] px-1 py-2 text-right font-semibold">%</th>
              <th className="w-[34%] px-1 py-2 text-right font-semibold">Status</th>
              <th className="w-[10%] py-2 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const open = openDate === r.date;
              return (
                <tr key={r.date} className="text-xs">
                  <td colSpan={5} className="p-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenDate(open ? null : r.date)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenDate(open ? null : r.date);
                        }
                      }}
                      className="flex cursor-pointer items-center gap-2 px-2 py-2.5 transition-colors hover:bg-card-2/30"
                    >
                      <span className="w-[16%] font-mono tabular-nums text-muted">{r.date.slice(5)}</span>
                      <span className="w-[22%] text-right font-mono tabular-nums text-foreground">{formatNumber(r.dailyActual)}</span>
                      <span className={cn("w-[18%] text-right font-mono font-semibold tabular-nums", toneTextClass(r.tone))}>{r.tone === "none" ? "—" : formatPct1(r.pct)}</span>
                      <span className="flex w-[34%] items-center justify-end gap-2"><PerfPill tone={r.tone} compact /></span>
                      <span className="w-[10%] text-right text-xs text-subtle">{open ? "−" : "+"}</span>
                    </button>
                    {open && (
                      <div className="grid grid-cols-2 gap-2 border-t border-border bg-card-2/20 px-2 py-2 sm:grid-cols-4">
                        {r.perDep.map((p) => (
                          <Metric label={DEP_SHORT[p.dep]} value={formatNumber(p.daily)} key={p.dep} />
                        ))}
                        <Metric label="Day Total" value={formatNumber(r.dailyActual)} />
                        <Metric label="Cumulative" value={formatNumber(r.cumulative)} />
                        <Metric label="Track" value={formatNumber(r.track)} />
                        <Metric label="Status" value={r.tone === "none" ? "—" : r.tone === "excellent" ? "Excellent" : r.tone === "vgood" ? "V.Good" : r.tone === "good" ? "Good" : r.tone === "willdo" ? "Will Do" : "Danger"} />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile — Accordion per day */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const open = openDate === r.date;
          return (
            <div key={r.date} className="overflow-hidden rounded-xl border border-border bg-card-2/40">
              <button
                type="button"
                onClick={() => setOpenDate(open ? null : r.date)}
                className="flex w-full items-center gap-2 p-3 text-left"
                aria-expanded={open}
              >
                <span className="min-w-0 flex-1 font-mono text-xs font-semibold tabular-nums text-foreground">{r.date}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{formatNumber(r.dailyActual)}</span>
                <span className={cn("font-mono text-xs font-semibold tabular-nums", toneTextClass(r.tone))}>{r.tone === "none" ? "—" : formatPct1(r.pct)}</span>
                <span className="text-xs text-subtle">{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div className="grid grid-cols-2 gap-1.5 border-t border-border p-3">
                  {r.perDep.map((p) => <Metric label={DEP_SHORT[p.dep]} value={formatNumber(p.daily)} key={p.dep} />)}
                  <Metric label="Day Total" value={formatNumber(r.dailyActual)} />
                  <Metric label="Cumulative" value={formatNumber(r.cumulative)} />
                  <Metric label="Track" value={formatNumber(r.track)} />
                  <Metric label="Status" value={r.tone === "none" ? "—" : r.tone === "excellent" ? "Excellent" : r.tone === "vgood" ? "V.Good" : r.tone === "good" ? "Good" : r.tone === "willdo" ? "Will Do" : "Danger"} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
