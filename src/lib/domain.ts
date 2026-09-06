export const KPIS = [
  "Gross",
  "Pure",
  "Agency",
  "Tech Care",
  "CR",
  "Mylo",
  "GK",
] as const;

export type Kpi = (typeof KPIS)[number];

export const FIXED_KPI_TARGETS: Partial<Record<Kpi, number>> = {
  CR: 20,
};

export const DEPS = [
  "TV",
  "AC",
  "MDA",
  "SDA",
  "IT Laptop",
  "IT Other",
  "Telecom Mobile",
  "Telecom ACC",
] as const;
export type Dep = (typeof DEPS)[number];

export const PERIODS = [
  { id: "2026-04", label: "April 2026", short: "Apr" },
  { id: "2026-05", label: "May 2026", short: "May" },
  { id: "2026-06", label: "June 2026", short: "Jun" },
  { id: "2026-07", label: "July 2026", short: "Jul" },
  { id: "2026-08", label: "August 2026", short: "Aug" },
  { id: "2026-09", label: "September 2026", short: "Sep" },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

export type ViewId = "overview" | "tv" | "mda" | "mobile" | "reports";

export type Entry = { plan: number; result: number };
export type DeptBlock = Record<Kpi, Entry>;
export type BranchKpiData = Record<Kpi, Entry>;
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

export const SALES_GROUPS = [
  { id: "tv-ac", title: "TV + AC", deps: ["TV", "AC"] as Dep[] },
  { id: "mda-sda", title: "MDA + SDA", deps: ["MDA", "SDA"] as Dep[] },
  {
    id: "mobile",
    title: "Mobile",
    deps: ["IT Laptop", "IT Other", "Telecom Mobile", "Telecom ACC"] as Dep[],
  },
] as const;

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
  "IT Laptop": [
    { name: "ماركو", initials: "م" },
  ],
  "IT Other": [],
  "Telecom Mobile": [],
  "Telecom ACC": [],
};

export const LEAD_KPIS: Kpi[] = ["Gross", "Pure"];

export const REST_KPI_ROWS: Kpi[][] = [
  ["Agency", "Tech Care"],
  ["CR", "Mylo"],
  ["GK"],
];

// Backwards-compatible name: some components import KPI_ROWS
export const KPI_ROWS = REST_KPI_ROWS;

export const VIEW_DEP: Record<Exclude<ViewId, "overview" | "reports">, Dep> = {
  tv: "TV",
  mda: "MDA",
  mobile: "IT Laptop",
};

export const DEP_VIEW: Record<Dep, Exclude<ViewId, "overview" | "reports">> = {
  TV: "tv",
  AC: "tv",
  MDA: "mda",
  SDA: "mda",
  "IT Laptop": "mobile",
  "IT Other": "mobile",
  "Telecom Mobile": "mobile",
  "Telecom ACC": "mobile",
};

export const DEP_COPY: Record<Dep, { title: string; blurb: string }> = {
  TV: {
    title: "TV",
    blurb: "Television desk",
  },
  AC: {
    title: "AC",
    blurb: "Air-conditioning desk",
  },
  MDA: {
    title: "MDA",
    blurb: "Major domestic appliances",
  },
  SDA: {
    title: "SDA",
    blurb: "Small domestic appliances",
  },
  "IT Laptop": {
    title: "IT Laptop",
    blurb: "Laptops and related",
  },
  "IT Other": {
    title: "IT Other",
    blurb: "IT accessories",
  },
  "Telecom Mobile": {
    title: "Telecom Mobile",
    blurb: "Mobile handsets and plans",
  },
  "Telecom ACC": {
    title: "Telecom ACC",
    blurb: "Mobile accessories",
  },
};

export const DEP_SHORT: Record<Dep, string> = {
  TV: "TV",
  AC: "AC",
  MDA: "MDA",
  SDA: "SDA",
  "IT Laptop": "Laptop",
  "IT Other": "IT",
  "Telecom Mobile": "Mobile",
  "Telecom ACC": "ACC",
};

export const KPI_HINT: Record<Kpi, string> = {
  Gross: "Gross movement",
  Pure: "Pure contribution",
  Agency: "Agency deals",
  "Tech Care": "Tech Care attachments",
  CR: "In-branch invoice conversion rate",
  Mylo: "Installment sales",
  GK: "Large deal leads",
};

function seedDept(base: number): DeptBlock {
  return {
    Gross: { plan: base, result: Math.round(base * 0.92) },
    Pure: { plan: Math.round(base * 0.4), result: Math.round(base * 0.36) },
    Agency: { plan: 12, result: 9 },
    "Tech Care": { plan: 120, result: 104 },
    CR: { plan: 100, result: 88 },
    Mylo: { plan: 48, result: 40 },
    GK: { plan: 14, result: 11 },
  };
}

const SEPTEMBER: PeriodBlock = {
  TV: seedDept(520000),
  AC: seedDept(520000),
  MDA: seedDept(305000),
  SDA: seedDept(305000),
  "IT Laptop": seedDept(415000),
  "IT Other": seedDept(415000),
  "Telecom Mobile": seedDept(415000),
  "Telecom ACC": seedDept(415000),
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

export function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getDaysInMonth(period: PeriodId): number {
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

export function calculateDailyTarget(monthlyTarget: number, period: PeriodId): number {
  return monthlyTarget / getDaysInMonth(period);
}

// Daily department entries are cumulative month-to-date snapshots:
// the real actual is the value of the most recent entry, never the sum.
export function latestDailyValue(
  daily: Record<string, number>,
  upToDay?: number,
): number {
  let bestDate = "";
  let best = 0;
  for (const [date, value] of Object.entries(daily)) {
    if (upToDay !== undefined && Number(date.slice(-2)) > upToDay) continue;
    if (date > bestDate) {
      bestDate = date;
      best = value;
    }
  }
  return best;
}

export function cumulativeThroughDate(
  daily: Record<string, number>,
  beforeDate: string,
): number {
  let bestDate = "";
  let best = 0;
  for (const [date, value] of Object.entries(daily)) {
    if (date >= beforeDate) continue;
    if (date > bestDate) {
      bestDate = date;
      best = value;
    }
  }
  return best;
}

export function departmentMonthActual(
  daily: Record<string, number>,
  fallback: number,
): number {
  return Object.keys(daily).length > 0 ? latestDailyValue(daily) : fallback;
}

export function departmentFirstHalfActual(daily: Record<string, number>): number {
  return latestDailyValue(daily, 15);
}

export function departmentSecondHalfActual(daily: Record<string, number>): number {
  if (Object.keys(daily).length === 0) return 0;
  const latest = latestDailyValue(daily);
  const firstHalf = departmentFirstHalfActual(daily);
  return Math.max(0, latest - firstHalf);
}

export function getTrackDay(period: PeriodId | string, today: string): number {
  const currentPeriod = today.slice(0, 7);
  if (period < currentPeriod) {
    const [year, month] = period.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  }
  if (period > currentPeriod) return 0;
  return Math.max(0, Number(today.slice(-2)) - 1);
}

export function isSecondHalfVisible(period: PeriodId | string, today: string): boolean {
  const currentPeriod = today.slice(0, 7);
  if (period !== currentPeriod) return period < currentPeriod;
  return Number(today.slice(-2)) >= 16;
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
