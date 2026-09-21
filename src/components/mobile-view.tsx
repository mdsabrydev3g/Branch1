import { useMemo } from "react";
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
      {/* Desktop / Tablet — جدول واحد للأجزاء الأربعة */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wider text-subtle">
              <th className="w-[10%] py-2 pr-2 font-semibold">Date</th>
              <th className="w-[6%] px-1 py-2 font-semibold">Half</th>
              {MOBILE_DEPS.map((dep) => (
                <th key={dep} className="w-[11%] px-1 py-2 text-right font-semibold">
                  {DEP_SHORT[dep]}
                </th>
              ))}
              <th className="w-[11%] px-1 py-2 text-right font-semibold">Day Total</th>
              <th className="w-[12%] px-1 py-2 text-right font-semibold">Cum</th>
              <th className="w-[9%] px-1 py-2 text-right font-semibold">%</th>
              <th className="w-[9%] py-2 pl-1 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.date} className="text-xs transition-colors hover:bg-card-2/30">
                <td className="py-2.5 pr-2 font-mono tabular-nums text-muted">{r.date.slice(5)}</td>
                <td className="px-1 py-2.5 text-2xs font-semibold text-subtle">{r.half}</td>
                {r.perDep.map((p) => (
                  <td
                    key={p.dep}
                    className="px-1 py-2.5 text-right font-mono tabular-nums text-foreground"
                  >
                    {formatNumber(p.daily)}
                  </td>
                ))}
                <td className="px-1 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                  {formatNumber(r.dailyActual)}
                </td>
                <td className="px-1 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                  {formatNumber(r.cumulative)}
                </td>
                <td
                  className={cn(
                    "px-1 py-2.5 text-right font-mono font-semibold tabular-nums",
                    toneTextClass(r.tone),
                  )}
                >
                  {r.tone === "none" ? "—" : formatPct1(r.pct)}
                </td>
                <td className="py-2 pl-1 text-right">
                  <PerfPill tone={r.tone} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — كروت بلا أي سكرول أفقي */}
      <div className="space-y-4 md:hidden">
        {(["H1", "H2"] as const)
          .filter((h) => rows.some((r) => r.half === h))
          .map((half) => (
            <div key={half}>
              <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
                {halfLabel(half)}
              </div>
              <div className="space-y-2">
                {rows
                  .filter((r) => r.half === half)
                  .map((r) => (
                    <div key={r.date} className="rounded-xl border border-border bg-card-2/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                          {r.date}
                        </span>
                        <PerfPill tone={r.tone} compact />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {r.perDep.map((p) => (
                          <div key={p.dep} className="rounded-lg bg-card/80 px-2 py-1.5">
                            <div className="text-2xs text-subtle">{DEP_SHORT[p.dep]}</div>
                            <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
                              {formatNumber(p.daily)}
                            </div>
                          </div>
                        ))}
                        <div className="rounded-lg bg-primary/10 px-2 py-1.5">
                          <div className="text-2xs text-subtle">Day Total</div>
                          <div className="font-mono text-xs font-bold tabular-nums text-foreground">
                            {formatNumber(r.dailyActual)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-card/80 px-2 py-1.5">
                          <div className="text-2xs text-subtle">Cumulative</div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatNumber(r.cumulative)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
