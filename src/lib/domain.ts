export const KPIS = [
  "Gross",
  "Agency",
  "BOXI",
  "Mylo",
  "CR",
  "GK",
  "Gift",
] as const;

export type Kpi = (typeof KPIS)[number];

export const FIXED_KPI_TARGETS: Partial<Record<Kpi, number>> = {
  CR: 20,
  GK: 400,
};

/** مؤشرات تُعرض ككروت مصغّرة بجانب دائرة الفرع في صفحة Overview (تُحذف من جدول الـ KPI) */
export const BRANCH_MINI_KPIS: Kpi[] = ["CR", "GK", "Gift"];

/** مؤشرات جدول Main KPI performance (بدون كروت الدائرة) */
export const TABLE_KPIS: Kpi[] = ["Gross", "Agency", "BOXI", "Mylo"];

export const DEPS = [
  "TV",
  "AC",
  "MDA",
  "SDA",
  "Laptop",
  "Other",
  "Mobile",
  "ACC",
] as const;
export type Dep = (typeof DEPS)[number];

/** Dynamic periods: historical 2026 data is retained, future months/years are generated automatically. */
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"] as const;
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

export type PeriodId = string;

export function currentPeriodId(date = new Date()): PeriodId {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildPeriods(startYear: number, endYear: number) {
  const periods: { id: PeriodId; label: string; short: string }[] = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const id = `${year}-${String(month).padStart(2, "0")}`;
      periods.push({ id, label: `${MONTH_NAMES[month - 1]} ${year}`, short: MONTH_SHORT[month - 1] });
    }
  }
  return periods;
}

/** Automatically includes the current year plus the next year. */
export const PERIODS = buildPeriods(2026, Math.max(new Date().getFullYear() + 1, 2027));

export type ViewId = "overview" | "tv" | "mda" | "mobile" | "daily" | "reports";

export type Entry = { plan: number; result: number };
export type DeptBlock = Record<Kpi, Entry>;
export type BranchKpiData = Record<Kpi, Entry>;
/** Branch KPI values are isolated by YYYY-MM period. */
export type BranchKpiDataByPeriod = Partial<Record<PeriodId, BranchKpiData>>;
export type PeriodBlock = Record<Dep, DeptBlock>;
export type PerformanceData = Record<PeriodId, PeriodBlock>;
export type DailyActuals = Partial<Record<
  PeriodId,
  Partial<Record<Dep, Partial<Record<Kpi, Record<string, number>>>>>
>>;
export type BranchDailyActuals = Partial<
  Record<PeriodId, Partial<Record<Kpi, Record<string, number>>>>
>;
export type DepartmentDailyActuals = Partial<
  Record<PeriodId, Partial<Record<Dep, Record<string, number>>>>
>;
export type DepartmentTargets = Partial<Record<PeriodId, Partial<Record<Dep, number>>>>;
export type BranchKpiTargets = Partial<Record<PeriodId, Partial<Record<Kpi, number>>>>;

export const SALES_GROUPS = [
  {
    id: "mobile",
    title: "Mobile",
    deps: ["Laptop", "Other", "Mobile", "ACC"] as Dep[],
  },
  { id: "mda-sda", title: "MDA-SDA", deps: ["MDA", "SDA"] as Dep[] },
  { id: "tv-ac", title: "TV-AC", deps: ["TV", "AC"] as Dep[] },
] as const;

export type SalesGroupId = (typeof SALES_GROUPS)[number]["id"];

/**
 * Manager-provided first-half (first 15 days of the month) cumulative actuals
 * per sales group. The Daily Editor stores cumulative readings by date; when
 * no reading was captured for day 15, these values stand in for the computed
 * first-half actual, and the second half is derived by subtraction
 * (cumulative − first half).
 */
export const FIRST_HALF_ACTUAL_OVERRIDES: Partial<
  Record<PeriodId, Partial<Record<SalesGroupId, number>>>
> = {
  "2026-09": {
    "tv-ac": 728466,
    "mda-sda": 2571348,
    mobile: 5501737,
  },
};

export function firstHalfOverrideFor(
  period: PeriodId,
  groupId: SalesGroupId,
): number | undefined {
  return FIRST_HALF_ACTUAL_OVERRIDES[period]?.[groupId];
}

export const DEP_OWNERS: Record<
  Dep,
  { name: string; initials: string }[]
> = {
  TV: [
    { name: "ربيع", initials: "ر" },
    { name: "كريم", initials: "ك" },
  ],
  AC: [
    { name: "إسلام", initials: "إ" },
    { name: "عمر", initials: "ع" },
  ],
  MDA: [
    { name: "فاطمة", initials: "ف" },
  ],
  SDA: [
    { name: "يحيى", initials: "ي" },
  ],
  "Laptop": [
    { name: "ماركو", initials: "م" },
  ],
  "Other": [],
  "Mobile": [],
  "ACC": [],
};

export const LEAD_KPIS: Kpi[] = ["Gross"];

export const REST_KPI_ROWS: Kpi[][] = [
  ["Agency", "BOXI"],
  ["CR", "Mylo"],
  ["GK"],
];

// Backwards-compatible name: some components import KPI_ROWS
export const KPI_ROWS = REST_KPI_ROWS;

export const VIEW_DEP: Record<Exclude<ViewId, "overview" | "reports" | "daily">, Dep> = {
  tv: "TV",
  mda: "MDA",
  mobile: "Laptop",
};

export const DEP_VIEW: Record<Dep, Exclude<ViewId, "overview" | "reports">> = {
  TV: "tv",
  AC: "tv",
  MDA: "mda",
  SDA: "mda",
  "Laptop": "mobile",
  "Other": "mobile",
  "Mobile": "mobile",
  "ACC": "mobile",
};

export const DEP_COPY: Record<Dep, { title: string }> = {
  TV: { title: "TV" },
  AC: { title: "AC" },
  MDA: { title: "MDA" },
  SDA: { title: "SDA" },
  "Laptop": { title: "Laptop" },
  "Other": { title: "Other" },
  "Mobile": { title: "Mobile" },
  "ACC": { title: "ACC" },
};

export const DEP_SHORT: Record<Dep, string> = {
  TV: "TV",
  AC: "AC",
  MDA: "MDA",
  SDA: "SDA",
  "Laptop": "Laptop",
  "Other": "Other",
  "Mobile": "Mobile",
  "ACC": "ACC",
};

export const KPI_HINT: Record<Kpi, string> = {
  Gross: "Gross movement",
  Agency: "Agency deals",
  BOXI: "BOXI attachments",
  CR: "In-branch invoice conversion rate",
  Mylo: "Installment sales",
  GK: "Large deal leads",
  Gift: "Gift sales",
};

function seedDept(base: number): DeptBlock {
  return {
    Gross: { plan: base, result: Math.round(base * 0.92) },
    Agency: { plan: 12, result: 9 },
    BOXI: { plan: 120, result: 104 },
    Mylo: { plan: 48, result: 40 },
    CR: { plan: 100, result: 88 },
    GK: { plan: 14, result: 11 },
    Gift: { plan: 20, result: 16 },
  };
}

const SEPTEMBER: PeriodBlock = {
  TV: seedDept(520000),
  AC: seedDept(520000),
  MDA: seedDept(305000),
  SDA: seedDept(305000),
  "Laptop": seedDept(415000),
  "Other": seedDept(415000),
  "Mobile": seedDept(415000),
  "ACC": seedDept(415000),
};

const HISTORY: { id: PeriodId; plan: number; result: number }[] = [
  { id: "2026-04", plan: 0.68, result: 0.52 },
  { id: "2026-05", plan: 0.74, result: 0.61 },
  { id: "2026-06", plan: 0.8, result: 0.7 },
  { id: "2026-07", plan: 0.88, result: 0.79 },
  { id: "2026-08", plan: 0.95, result: 0.9 },
  { id: "2026-09", plan: 1, result: 1 },
];

function scalePeriod(src: PeriodBlock, p: number, r: number): PeriodBlock {
  const out = {} as PeriodBlock;
  for (const dep of DEPS) {
    const block = {} as DeptBlock;
    for (const kpi of KPIS) {
      block[kpi] = {
        plan: Math.round(src[dep][kpi].plan * p),
        result: Math.round(src[dep][kpi].result * r),
      };
    }
    out[dep] = block;
  }
  return out;
}

export function createSeed(): PerformanceData {
  const data = {} as PerformanceData;
  for (const period of PERIODS) {
    const block = {} as PeriodBlock;
    for (const dep of DEPS) block[dep] = emptyDept();
    data[period.id] = block;
  }
  return data;
}

export function createBranchKpiSeed(): BranchKpiData {
  const data = {} as BranchKpiData;
  for (const kpi of KPIS) data[kpi] = { plan: 0, result: 0 };
  return data;
}

export function emptyDept(): DeptBlock {
  const block = {} as DeptBlock;
  for (const kpi of KPIS) block[kpi] = { plan: 0, result: 0 };
  return block;
}

export function sumBlock(block: DeptBlock): Entry {
  return KPIS.reduce(
    (acc, kpi) => ({
      plan: acc.plan + block[kpi].plan,
      result: acc.result + block[kpi].result,
    }),
    { plan: 0, result: 0 },
  );
}

export function sumPeriod(period: PeriodBlock): Entry {
  return DEPS.reduce(
    (acc, dep) => {
      const s = sumBlock(period[dep]);
      return { plan: acc.plan + s.plan, result: acc.result + s.result };
    },
    { plan: 0, result: 0 },
  );
}

export function sumKpi(period: PeriodBlock, kpi: Kpi): Entry {
  return DEPS.reduce(
    (acc, dep) => ({
      plan: acc.plan + period[dep][kpi].plan,
      result: acc.result + period[dep][kpi].result,
    }),
    { plan: 0, result: 0 },
  );
}

export function ratio(entry: Entry): number {
  if (!entry.plan) return entry.result > 0 ? 1 : 0;
  return entry.result / entry.plan;
}

export function openGap(entry: Entry): number {
  return Math.max(0, entry.plan - entry.result);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value || 0,
  );
}

/**
 * Keep long formatted numbers inside their stat boxes: shrink the font as the
 * digit count grows. Calibrated against rendered widths (mono advance ≈ 0.6em)
 * for the reports summary cards (~110px+ content) and department stat boxes
 * (~79px content on phones). Words like status labels keep the full size.
 */
export function fitTextClass(text: string): string {
  if (!/\d/.test(text)) return "text-lg";
  const len = text.length;
  if (len <= 6) return "text-lg";
  if (len <= 8) return "text-sm sm:text-lg";
  return "text-[11px] sm:text-base";
}

export function fitNumberClass(value: number): string {
  return fitTextClass(formatNumber(value));
}

/** Same idea for the tighter milestone metric boxes (~61px content on sm+). */
export function fitSmallTextClass(text: string): string {
  const len = text.length;
  if (len <= 7) return "text-xs sm:text-sm";
  if (len <= 9) return "text-xs sm:text-[11px]";
  return "text-xs sm:text-[10px]";
}

/** And for the narrow branch-KPI summary cells (~63px content on sm). */
export function fitDenseTextClass(text: string): string {
  if (!/\d/.test(text)) return "text-sm sm:text-base";
  const len = text.length;
  if (len <= 6) return "text-sm sm:text-base";
  if (len <= 8) return "text-[11px] sm:text-[12px]";
  return "text-[10px]";
}

export function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getDaysInMonth(period: PeriodId): number {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTrackDay(period: PeriodId, today = localDateString()): number {
  const currentPeriod = today.slice(0, 7);
  if (period < currentPeriod) return getDaysInMonth(period);
  if (period > currentPeriod) return 0;
  return Math.max(0, Number(today.slice(-2)) - 1);
}

export function showSecondHalf(period: PeriodId, today = localDateString()): boolean {
  const currentPeriod = today.slice(0, 7);
  if (period < currentPeriod) return true;
  if (period > currentPeriod) return false;
  return Number(today.slice(-2)) >= 16;
}

export function latestDailyValue(daily: Record<string, number> | undefined): number {
  if (!daily) return 0;
  const dates = Object.keys(daily).sort();
  if (!dates.length) return 0;
  return Number(daily[dates[dates.length - 1]]) || 0;
}

/**
 * الإدخال في Daily Editor = قراءة تراكمية (المحقق من بداية الشهر حتى التاريخ).
 * المحقق التراكمي حتى يوم maxDay = آخر قراءة مُدخلة بتاريخ ≤ ذلك اليوم.
 */
export function cumAtDay(
  daily: Record<string, number> | undefined,
  maxDay: number,
): number {
  return latestDailyValueUpToDay(daily, maxDay);
}

/**
 * مبيعات اليوم المختار = قراءة اليوم التراكمية − آخر قراءة تراكمية قبلها.
 * (المستخدم يدخل المحقق التراكمي يومياً، والفرق بين يومين = محقق اليوم نفسه)
 */
export function dailyDiffAt(
  daily: Record<string, number> | undefined,
  date: string,
): number {
  if (!daily || !(date in daily)) return 0;
  const cur = Number(daily[date]) || 0;
  const prevDates = Object.keys(daily)
    .filter((d) => d < date)
    .sort();
  const prev = prevDates.length ? Number(daily[prevDates[prevDates.length - 1]]) || 0 : 0;
  return Math.max(0, cur - prev);
}

/**
 * مجموع إدخالات المحقق اليومي من بداية الشهر حتى maxDay (شاملاً).
 * الإدخال في Daily Editor = مبيعات اليوم فقط، والتجميع (Cumulative) يُحسب هنا.
 */
export function sumDailyUpToDay(
  daily: Record<string, number> | undefined,
  maxDay: number,
): number {
  if (!daily) return 0;
  let sum = 0;
  for (const [date, value] of Object.entries(daily)) {
    if (Number(date.slice(-2)) <= maxDay) sum += Number(value) || 0;
  }
  return sum;
}

export function latestDailyValueUpToDay(
  daily: Record<string, number> | undefined,
  maxDay: number,
): number {
  if (!daily) return 0;
  const dates = Object.keys(daily)
    .filter((date) => Number(date.slice(-2)) <= maxDay)
    .sort();
  if (!dates.length) return 0;
  return Number(daily[dates[dates.length - 1]]) || 0;
}

export function monthActualFromDaily(
  daily: Record<string, number> | undefined,
  fallback = 0,
): number {
  if (daily && Object.keys(daily).length > 0) return latestDailyValue(daily);
  return fallback;
}

export function firstHalfActualFromDaily(
  daily: Record<string, number> | undefined,
): number {
  return latestDailyValueUpToDay(daily, 15);
}

export function secondHalfActualFromDaily(
  daily: Record<string, number> | undefined,
): number {
  const monthActual = latestDailyValue(daily);
  const firstHalf = firstHalfActualFromDaily(daily);
  const hasSecondHalf = Object.keys(daily ?? {}).some(
    (date) => Number(date.slice(-2)) > 15,
  );
  if (!hasSecondHalf) return 0;
  return Math.max(0, monthActual - firstHalf);
}

export function calculateDailyTarget(monthlyTarget: number, period: PeriodId): number {
  return monthlyTarget / getDaysInMonth(period);
}

export function calculateTrackTarget(
  monthlyTarget: number,
  period: PeriodId,
  today = localDateString(),
): number {
  return calculateDailyTarget(monthlyTarget, period) * getTrackDay(period, today);
}

export function calculateFirstHalfTarget(monthlyTarget: number, period: PeriodId): number {
  return calculateDailyTarget(monthlyTarget, period) * 15;
}

export function calculateSecondHalfTarget(monthlyTarget: number, period: PeriodId): number {
  return calculateDailyTarget(monthlyTarget, period) * (getDaysInMonth(period) - 15);
}

export function calculateRemaining(target: number, actual: number): number {
  return Math.max(0, target - actual);
}

export function calculate80PercentTarget(monthlyTarget: number): number {
  return monthlyTarget * 0.8;
}

export function calculate85PercentTarget(monthlyTarget: number): number {
  return monthlyTarget * 0.85;
}

export function parseLoose(raw: string): number {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

export type StatusTone = "good" | "watch" | "bad";

export function statusOf(value: number): {
  tone: StatusTone;
  label: string;
  report: string;
} {
  if (value >= 1) return { tone: "good", label: "Good", report: "Good" };
  if (value >= 0.8) return { tone: "watch", label: "Will Do", report: "Will Do" };
  return { tone: "bad", label: "Danger", report: "Danger" };
}

export function periodMeta(id: PeriodId) {
  return PERIODS.find((p) => p.id === id) ?? PERIODS[PERIODS.length - 1];
}

const LEGACY_KEY = "fayoumGlobalData";

type LegacyEntry = { target?: number; actual?: number };

export function readLegacySeptember(): PeriodBlock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<
      string,
      Record<string, LegacyEntry>
    >;
    const out = {} as PeriodBlock;
    for (const dep of DEPS) {
      if (!parsed[dep]) return null;
      const block = {} as DeptBlock;
      for (const kpi of KPIS) {
        const cell = parsed[dep][kpi];
        if (!cell) return null;
        block[kpi] = {
          plan: Number(cell.target) || 0,
          result: Number(cell.actual) || 0,
        };
      }
      out[dep] = block;
    }
    return out;
  } catch {
    return null;
  }
}
