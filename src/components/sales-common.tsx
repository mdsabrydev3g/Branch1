import {
  fitNumberClass,
  formatNumber,
  cumAtDay,
  dailyDiffAt,
  calculate80PercentTarget,
  calculate85PercentTarget,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

/* ============================================================
   نظام أقسام المبيعات المشترك — TV-AC و MDA-SDA و Mobile
   الإدخال في Daily Editor = قراءة تراكمية بتاريخ اليوم.
   مبيعات اليوم = قراءة اليوم − قراءة اليوم السابق (تلقائي).
   ============================================================ */
export const HALF1_DAYS = 15; // النصف الأول: أيام 1..15 — النصف الثاني: 16..آخر الشهر
export const STATUS_WILL_DO_MIN = 0.7;
export const STATUS_GOOD_MIN = 0.8;
export const STATUS_EXCELLENT_MIN = 0.9;

export type PerfTone = "excellent" | "good" | "willdo" | "danger" | "none";

const PERF_TONE: Record<PerfTone, { label: string; className: string }> = {
  excellent: {
    label: "Excellent",
    className:
      "border-emerald-300/40 bg-emerald-400/15 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.35)]",
  },
  good: { label: "Good", className: "border-success/30 bg-success/12 text-success" },
  willdo: { label: "Will Do", className: "border-warning/30 bg-warning/12 text-warning" },
  danger: { label: "Danger", className: "border-danger/30 bg-danger/12 text-danger" },
  none: { label: "—", className: "border-border bg-card-2/60 text-subtle" },
};

/** لون نص النسبة حسب الحالة: أخضر / أصفر / أحمر */
const TONE_TEXT: Record<PerfTone, string> = {
  excellent: "text-emerald-300",
  good: "text-success",
  willdo: "text-warning",
  danger: "text-danger",
  none: "text-muted",
};

export function toneTextClass(tone: PerfTone): string {
  return TONE_TEXT[tone];
}

/** الأولوية: Actual>=Track أو %>=90 → Excellent، ثم %>=80 → Good، ثم %>=70 → Will Do، وإلا Danger */
export function perfOf(actual: number, track: number): { tone: PerfTone; pct: number } {
  if (track <= 0) return { tone: "none", pct: 0 };
  const pct = actual / track;
  if (actual >= track || pct >= STATUS_EXCELLENT_MIN) return { tone: "excellent", pct };
  if (pct >= STATUS_GOOD_MIN) return { tone: "good", pct };
  if (pct >= STATUS_WILL_DO_MIN) return { tone: "willdo", pct };
  return { tone: "danger", pct };
}

export function PerfPill({ tone, compact }: { tone: PerfTone; compact?: boolean }) {
  const t = PERF_TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border font-semibold transition-all duration-300",
        compact ? "h-5 px-1.5 text-[10px]" : "h-6 px-2.5 text-2xs",
        t.className,
      )}
    >
      {t.label}
    </span>
  );
}

/** نسبة صحيحة بلا كسور: 86% — الحسابات الداخلية تبقى بدقتها الكاملة */
export function formatPct1(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

export function Metric({
  label,
  value,
  fit,
  tone,
}: {
  label: string;
  value: string;
  fit?: number;
  tone?: PerfTone;
}) {
  return (
    <div className="rounded-xl bg-card-2/50 p-3 text-center">
      <div className="text-2xs uppercase tracking-wider text-subtle">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono font-bold tabular-nums",
          fit !== undefined ? fitNumberClass(fit) : "text-sm sm:text-base",
          tone ? toneTextClass(tone) : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   الحسابات المركزية — نفس الدوال لكل المستويات
   ============================================================ */
export interface SectionStats {
  monthlyTarget: number;
  dailyTarget: number;
  monthTrack: number;
  monthActual: number;
  h1Target: number;
  h1Track: number;
  h1Actual: number;
  h2Days: number;
  h2Target: number;
  h2Track: number;
  h2Actual: number;
  frozen: boolean;
}

/**
 * القيم المخزّنة قراءات تراكمية بتاريخها:
 *   المحقق التراكمي = آخر قراءة ≤ اليوم المطلوب
 *   النصف الأول = آخر قراءة ≤ يوم 15 (مثبّت)
 *   النصف الثاني = التراكمي الحالي − المثبّت للنصف الأول
 */
export function computeStats(
  daily: Record<string, number>,
  monthlyTarget: number,
  daysInMonth: number,
  trackDay: number,
): SectionStats {
  const dailyTarget = monthlyTarget / daysInMonth;
  const h1Target = dailyTarget * HALF1_DAYS;
  const h1Track = dailyTarget * Math.min(trackDay, HALF1_DAYS);
  const h1Actual = cumAtDay(daily, HALF1_DAYS);
  const h2Days = daysInMonth - HALF1_DAYS;
  const h2Target = dailyTarget * h2Days;
  const h2Track = dailyTarget * Math.max(0, trackDay - HALF1_DAYS);
  const monthActual = cumAtDay(daily, trackDay);
  const h2Actual = Math.max(0, monthActual - h1Actual);
  const monthTrack = dailyTarget * trackDay;
  return {
    monthlyTarget,
    dailyTarget,
    monthTrack,
    monthActual,
    h1Target,
    h1Track,
    h1Actual,
    h2Days,
    h2Target,
    h2Track,
    h2Actual,
    frozen: trackDay >= HALF1_DAYS,
  };
}

/* ============================================================
   صفوف التفاصيل اليومية
   ============================================================ */
export type SalesRow = {
  date: string;
  day: number;
  half: "H1" | "H2";
  dailyActual: number;
  cumulative: number;
  track: number;
  pct: number;
  tone: PerfTone;
};

/** القيمة المخزّنة قراءة تراكمية: اليومية = فرق القراءات، والتراكمي = القراءة نفسها */
export function buildRows(daily: Record<string, number>, dailyTarget: number): SalesRow[] {
  const dates = Object.keys(daily).sort();
  return dates.map((date) => {
    const day = Number(date.slice(-2));
    const dailyActual = dailyDiffAt(daily, date);
    const cumulative = Number(daily[date]) || 0;
    const track = dailyTarget * day;
    const { tone, pct } = perfOf(cumulative, track);
    return {
      date,
      day,
      half: day <= HALF1_DAYS ? ("H1" as const) : ("H2" as const),
      dailyActual,
      cumulative,
      track,
      pct,
      tone,
    };
  });
}

/* ============================================================
   كارت النصف (Half 1 / Half 2) + صف الـ Checkpoint (80% / 85%)
   ============================================================ */
export function HalfCard({
  title,
  daysLabel,
  target,
  track,
  actual,
  frozen,
  checkpointPct,
}: {
  title: string;
  daysLabel: string;
  target: number;
  track: number;
  actual: number;
  frozen: boolean;
  checkpointPct: number;
}) {
  const [open, setOpen] = useState(!frozen);
  useEffect(() => setOpen(!frozen), [frozen]);

  const { tone, pct } = perfOf(actual, track);
  const cpTarget = checkpointPct === 0.8
    ? calculate80PercentTarget(target)
    : calculate85PercentTarget(target);
  const cpPerf = perfOf(actual, cpTarget);
  const cpLabel = Math.round(checkpointPct * 100);

  return (
    <section className="hairline gradient-border rounded-2xl bg-card/90 p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">{title}</h3>
          <p className="text-2xs text-subtle sm:text-xs">{daysLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {frozen ? (
            <span className={cn(
              "font-mono text-sm font-bold tabular-nums sm:text-base",
              toneTextClass(cpPerf.tone),
            )}>
              {cpPerf.tone === "none" ? "—" : formatPct1(cpPerf.pct)}
            </span>
          ) : (
            <PerfPill tone={tone} compact />
          )}
          <span className="text-xs text-subtle">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Target" value={formatNumber(target)} fit={target} />
            <Metric label="Track" value={formatNumber(track)} fit={track} />
            <Metric label="Actual" value={formatNumber(actual)} fit={actual} />
            <Metric
              label="Remaining"
              value={formatNumber(Math.max(0, target - actual))}
              fit={Math.max(0, target - actual)}
            />
          </div>

          <div className="mt-3 text-center">
            <div className={cn(
              "font-mono text-3xl font-bold tabular-nums",
              toneTextClass(tone),
            )}>
              {tone === "none" ? "—" : formatPct1(pct)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card-2/60 px-3 py-2">
            <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">
              Checkpoint {cpLabel}%
            </span>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xs tabular-nums text-foreground">
                {formatNumber(cpTarget)}
              </span>
              <span className={cn(
                "font-mono text-sm font-bold tabular-nums",
                toneTextClass(cpPerf.tone),
              )}>
                {cpPerf.tone === "none" ? "—" : formatPct1(cpPerf.pct)}
              </span>
              <PerfPill tone={cpPerf.tone} compact />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   تفاصيل الأيام — جدول على الشاشات الكبيرة وكروت على الموبايل
   ============================================================ */
export function DailyDetails({
  rows,
  daysInMonth,
}: {
  rows: SalesRow[];
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
      {/* Desktop / Tablet */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="border-b border-border text-2xs uppercase tracking-wider text-subtle">
              <th className="w-[13%] py-2 pr-2 font-semibold">Date</th>
              <th className="w-[9%] px-1 py-2 font-semibold">Half</th>
              <th className="w-[15%] px-1 py-2 text-right font-semibold">Daily</th>
              <th className="w-[17%] px-1 py-2 text-right font-semibold">Cumulative</th>
              <th className="w-[17%] px-1 py-2 text-right font-semibold">Track</th>
              <th className="w-[11%] px-1 py-2 text-right font-semibold">%</th>
              <th className="w-[18%] py-2 pl-1 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.date} className="text-xs transition-colors hover:bg-card-2/30">
                <td className="py-2.5 pr-2 font-mono tabular-nums text-muted">{r.date.slice(5)}</td>
                <td className="px-1 py-2.5 text-2xs font-semibold text-subtle">{r.half}</td>
                <td className="px-1 py-2.5 text-right font-mono tabular-nums text-foreground">
                  {formatNumber(r.dailyActual)}
                </td>
                <td className="px-1 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                  {formatNumber(r.cumulative)}
                </td>
                <td className="px-1 py-2.5 text-right font-mono tabular-nums text-muted">
                  {formatNumber(r.track)}
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

      {/* Mobile — كروت بدل الجدول: بلا أي سكرول أفقي */}
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
                        <div className="rounded-lg bg-card/80 px-2 py-1.5">
                          <div className="text-2xs text-subtle">Daily</div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatNumber(r.dailyActual)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-card/80 px-2 py-1.5">
                          <div className="text-2xs text-subtle">Cumulative</div>
                          <div className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatNumber(r.cumulative)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-card/80 px-2 py-1.5">
                          <div className="text-2xs text-subtle">Track</div>
                          <div className="font-mono text-xs tabular-nums text-muted">
                            {formatNumber(r.track)}
                          </div>
                        </div>
                        <div className="rounded-lg bg-card/80 px-2 py-1.5">
                          <div className="text-2xs text-subtle">%</div>
                          <div
                            className={cn(
                              "font-mono text-xs font-semibold tabular-nums",
                              toneTextClass(r.tone),
                            )}
                          >
                            {r.tone === "none" ? "—" : formatPct1(r.pct)}
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

/* ============================================================
   Section واحدة موحّدة — تُستخدم لكل مستويات العرض
   ============================================================ */
export function Section({
  title,
  subtitle,
  s,
  rows,
  daysInMonth,
  half2Visible,
  highlight,
  children,
}: {
  title: string;
  subtitle?: string;
  s: SectionStats;
  rows: SalesRow[];
  daysInMonth: number;
  half2Visible: boolean;
  highlight?: boolean;
  /** جدول تفاصيل بديل (مثال: أعمدة أجزاء القسم في صفحة Mobile) */
  children?: React.ReactNode;
}) {
  const monthPerf = perfOf(s.monthActual, s.monthTrack);
  return (
    <section
      className={cn(
        "hairline print-surface rounded-2xl bg-card/90 p-4 sm:p-6",
        highlight && "gradient-border ring-1 ring-primary/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cn("font-bold text-foreground", highlight ? "text-2xl" : "text-xl")}>
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Overall Summary */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Monthly Target" value={formatNumber(s.monthlyTarget)} fit={s.monthlyTarget} />
        <Metric label="Daily Target" value={formatNumber(s.dailyTarget)} fit={s.dailyTarget} />
        <Metric label="Track" value={formatNumber(s.monthTrack)} fit={s.monthTrack} />
        <Metric label="Cum. Actual" value={formatNumber(s.monthActual)} fit={s.monthActual} />
        <Metric
          label="Month %"
          value={monthPerf.tone === "none" ? "—" : formatPct1(monthPerf.pct)}
          tone={monthPerf.tone}
        />
        <div className="flex items-center justify-center rounded-xl bg-card-2/50 p-3">
          <PerfPill tone={monthPerf.tone} />
        </div>
      </div>

      {/* Half 1 + Half 2 */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <HalfCard
          title="Half 1"
          daysLabel={`Days 1-${HALF1_DAYS}`}
          target={s.h1Target}
          track={s.h1Track}
          actual={s.h1Actual}
          frozen={s.frozen}
          checkpointPct={0.8}
        />
        {half2Visible && (
          <HalfCard
            title="Half 2"
            daysLabel={`Days ${HALF1_DAYS + 1}-${daysInMonth}`}
            target={s.h2Target}
            track={s.h2Track}
            actual={s.h2Actual}
            frozen={false}
            checkpointPct={0.85}
          />
        )}
      </div>

      {/* Daily Details */}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          {title} — Daily Details
        </h3>
        {children ?? <DailyDetails rows={rows} daysInMonth={daysInMonth} />}
      </div>
    </section>
  );
}
