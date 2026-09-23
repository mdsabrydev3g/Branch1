import { create } from "zustand";
import {
  createSeed,
  currentPeriodId,
  createBranchKpiSeed,
  type BranchKpiData,
  type BranchKpiDataByPeriod,
  type Dep,
  type Entry,
  type Kpi,
  type PerformanceData,
  type PeriodId,
  type ViewId,
  type DailyActuals,
  type BranchDailyActuals,
  type DepartmentDailyActuals,
  type DepartmentTargets,
  type BranchKpiTargets,
} from "@/lib/domain";
import { saveKpiCell } from "@/lib/performance-api";
import { loadDashboardState, saveDashboardState } from "@/lib/dashboard-api";
import { getAdminSession } from "@/lib/auth/admin-api";

const STORAGE_KEY = "fayoum-pcc-v2";
const STORAGE_VERSION = 7;
/** المفاتيح القديمة التي تمت إعادة تسميتها → الاسم الجديد (ترحيل البيانات المحفوظة) */
const RENAMED_KPIS: Record<string, string> = { Vature: "Voucher", Voucher: "Gift" };

type Field = keyof Entry;
export type SaveState = "idle" | "saving" | "saved" | "error";

export type Role = "manager" | "staff";

interface PerfState {
  view: ViewId;
  period: PeriodId;
  data: PerformanceData;
  branchKpis: BranchKpiData;
  branchKpisByPeriod: BranchKpiDataByPeriod;
  dailyActuals: DailyActuals;
  branchDailyActuals: BranchDailyActuals;
  departmentDailyActuals: DepartmentDailyActuals;
  departmentTargets: DepartmentTargets;
  branchKpiTargets: BranchKpiTargets;
  hydrated: boolean;
  saveState: SaveState;
  role: Role;
  setRole: (r: Role) => void;
  /** يثبّت الدور من جلسة السيرفر — المصدر الوحيد للصلاحية. */
  syncRole: () => Promise<void>;
  exitManager: () => void;
  setView: (view: ViewId) => void;
  setPeriod: (period: PeriodId) => void;
  setValue: (dep: Dep, kpi: Kpi, field: Field, value: number) => void;
  setBranchValue: (kpi: Kpi, field: Field, value: number) => void;
  setDailyActual: (dep: Dep, kpi: Kpi, date: string, value: number) => void;
  setBranchDailyActual: (kpi: Kpi, date: string, value: number) => void;
  setBranchKpiTarget: (kpi: Kpi, value: number) => void;
  setDepartmentDailyActual: (dep: Dep, date: string, value: number) => void;
  setDepartmentTarget: (dep: Dep, value: number) => void;
  saveBatchDaily: (params: {
    period: PeriodId;
    date: string;
    depActuals: Partial<Record<Dep, number>>;
    depTargets?: Partial<Record<Dep, number>>;
    kpiActuals: Partial<Record<Kpi, number>>;
    kpiTargets?: Partial<Record<Kpi, number>>;
  }) => Promise<void>;
  hydrate: (silent?: boolean) => Promise<void>;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * آخر لحظة حفظ محلي. التحديث الدوري (كل 15 ثانية) قد يعيد بيانات قديمة إذا
 * كانت استجابة GET قد انطلقت قبل اكتمال الحفظ — فلا نطبق عليها فوق ما حفظه
 * المستخدم للتو.
 */
let lastSaveAt = 0;
function markSaved() {
  lastSaveAt = Date.now();
}

function persistLocal(
  period: PeriodId,
  data: PerformanceData,
  dailyActuals: DailyActuals = {},
  branchDailyActuals: BranchDailyActuals = {},
  departmentDailyActuals: DepartmentDailyActuals = {},
  departmentTargets: DepartmentTargets = {},
  branchKpiTargets: BranchKpiTargets = {},
  branchKpisByPeriod: BranchKpiDataByPeriod = {},
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        period,
        data,
        dailyActuals,
        branchDailyActuals,
        departmentDailyActuals,
        departmentTargets,
        branchKpiTargets,
        branchKpisByPeriod,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function sharedStateFromStore(state: Pick<
  PerfState,
  | "period"
  | "data"
  | "branchKpis"
  | "dailyActuals"
  | "branchDailyActuals"
  | "departmentDailyActuals"
  | "departmentTargets"
  | "branchKpiTargets"
  | "branchKpisByPeriod"
>): Parameters<typeof saveDashboardState>[0]["data"] {
  return {
    period: state.period,
    data: state.data,
    branchKpis: state.branchKpis,
    dailyActuals: state.dailyActuals,
    branchDailyActuals: state.branchDailyActuals,
    departmentDailyActuals: state.departmentDailyActuals,
    departmentTargets: state.departmentTargets,
    branchKpiTargets: state.branchKpiTargets,
    branchKpisByPeriod: state.branchKpisByPeriod,
  };
}

let sharedSaveTimer: ReturnType<typeof setTimeout> | undefined;

function queueSharedSave(get: () => PerfState) {
  if (sharedSaveTimer) clearTimeout(sharedSaveTimer);
  sharedSaveTimer = setTimeout(() => {
    void saveDashboardState({ data: sharedStateFromStore(get()) });
  }, 300);
}

function readSaved(): {
  period: PeriodId;
  data: PerformanceData;
  dailyActuals: DailyActuals;
  branchDailyActuals: BranchDailyActuals;
  departmentDailyActuals: DepartmentDailyActuals;
  departmentTargets: DepartmentTargets;
  branchKpiTargets: BranchKpiTargets;
  branchKpisByPeriod: BranchKpiDataByPeriod;
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      period?: PeriodId;
      data?: PerformanceData;
      dailyActuals?: DailyActuals;
      branchDailyActuals?: BranchDailyActuals;
      departmentDailyActuals?: DepartmentDailyActuals;
      departmentTargets?: DepartmentTargets;
      branchKpiTargets?: BranchKpiTargets;
      branchKpisByPeriod?: BranchKpiDataByPeriod;
      version?: number;
    };
    if (!parsed.data || !parsed.period || parsed.version === undefined) return null;

    // ترحيل الأسماء القديمة (مؤشرات: Vature → Voucher → Gift)
    // (أقسام: IT Laptop → Laptop، IT Other → Other، Telecom Mobile → Mobile، Telecom ACC → ACC)
    if (parsed.version < STORAGE_VERSION) {
      const changed = migrateNames(parsed);

      // اكتب الترحيل فورًا حتى لا تظل النسخة القديمة على القرص
      if (changed > 0) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              version: STORAGE_VERSION,
              period: parsed.period,
              data: parsed.data,
              dailyActuals: parsed.dailyActuals ?? {},
              branchDailyActuals: parsed.branchDailyActuals ?? {},
              departmentDailyActuals: parsed.departmentDailyActuals ?? {},
              departmentTargets: parsed.departmentTargets ?? {},
              branchKpiTargets: parsed.branchKpiTargets ?? {},
              branchKpisByPeriod: parsed.branchKpisByPeriod ?? { [parsed.period]: createBranchKpiSeed() },
            }),
          );
        } catch {
          /* الترحيل في الذاكرة يكفي */
        }
      }
    }

    return {
      period: parsed.period,
      data: parsed.data,
      dailyActuals: parsed.dailyActuals ?? {},
      branchDailyActuals: parsed.branchDailyActuals ?? {},
      departmentDailyActuals: parsed.departmentDailyActuals ?? {},
      departmentTargets: parsed.departmentTargets ?? {},
      branchKpiTargets: parsed.branchKpiTargets ?? {},
      branchKpisByPeriod: parsed.branchKpisByPeriod ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * ترحيل أسماء المؤشرات (Vature → Voucher → Gift) على أي كتلة بيانات
 * قادمة من السيرفر أو localStorage. تُطبّع في مكانه وتُرجع كمية التعديلات.
 */
const RENAMED_DEPS: Record<string, string> = {
  "IT Laptop": "Laptop",
  "IT Other": "Other",
  "Telecom Mobile": "Mobile",
  "Telecom ACC": "ACC",
};

function migrateNames(shared: {
  data?: PerformanceData;
  branchKpiTargets?: BranchKpiTargets;
  branchDailyActuals?: BranchDailyActuals;
  dailyActuals?: DailyActuals;
  departmentDailyActuals?: DepartmentDailyActuals;
  departmentTargets?: DepartmentTargets;
}): number {
  let changed = 0;
  const applyToMap = (map: Record<string, unknown> | undefined, renames: Record<string, string>) => {
    if (!map) return;
    for (const [oldKey, newKey] of Object.entries(renames)) {
      if (oldKey in map && !(newKey in map)) {
        map[newKey] = map[oldKey];
        delete map[oldKey];
        changed++;
      } else if (oldKey in map && newKey in map) {
        delete map[oldKey];
        changed++;
      }
    }
  };
  const applyKpis = (map: Record<string, unknown> | undefined) => applyToMap(map, RENAMED_KPIS);
  const applyDeps = (map: Record<string, unknown> | undefined) => applyToMap(map, RENAMED_DEPS);

  if (shared.data) {
    // مفاتيح الأقسام في data تتغير، ثم مفاتيح المؤشرات داخل كل قسم
    for (const period of Object.keys(shared.data)) {
      const block = shared.data[period as PeriodId];
      if (!block) continue;
      applyDeps(block as Record<string, unknown>);
      for (const dep of Object.keys(block)) {
        const dept = block[dep as keyof typeof block] as Record<string, Entry> | undefined;
        if (!dept) continue;
        applyKpis(dept);
      }
    }
  }
  if (shared.branchKpiTargets) {
    for (const period of Object.keys(shared.branchKpiTargets)) {
      applyKpis(shared.branchKpiTargets[period as PeriodId]);
    }
  }
  if (shared.branchKpisByPeriod) {
    for (const period of Object.keys(shared.branchKpisByPeriod)) {
      applyKpis(shared.branchKpisByPeriod[period as PeriodId]);
    }
  }
  if (shared.branchDailyActuals) {
    for (const period of Object.keys(shared.branchDailyActuals)) {
      applyKpis(shared.branchDailyActuals[period as PeriodId]);
    }
  }
  if (shared.dailyActuals) {
    for (const period of Object.keys(shared.dailyActuals)) {
      const block = shared.dailyActuals[period as PeriodId];
      if (!block) continue;
      applyDeps(block as Record<string, unknown>);
      for (const dep of Object.keys(block)) {
        const dept = block[dep as keyof typeof block] as Record<string, unknown> | undefined;
        if (dept) applyKpis(dept);
      }
    }
  }
  if (shared.departmentDailyActuals) {
    for (const period of Object.keys(shared.departmentDailyActuals)) {
      applyDeps(shared.departmentDailyActuals[period as PeriodId]);
    }
  }
  if (shared.departmentTargets) {
    for (const period of Object.keys(shared.departmentTargets)) {
      applyDeps(shared.departmentTargets[period as PeriodId]);
    }
  }
  return changed;
}

function queueSave(
  period: PeriodId,
  dep: Dep,
  kpi: Kpi,
  entry: Entry,
  onState: (s: SaveState) => void,
) {
  const key = `${period}:${dep}:${kpi}`;
  const prev = saveTimers.get(key);
  if (prev) clearTimeout(prev);
  onState("saving");
  saveTimers.set(
    key,
    setTimeout(() => {
      void saveKpiCell({
        data: {
          period,
          dept: dep,
          kpi,
          plan: entry.plan,
          result: entry.result,
        },
      })
        .then(() => onState("saved"))
        .catch(() => onState("error"));
    }, 280),
  );
}

export const usePerfStore = create<PerfState>((set, get) => ({
  view: "overview",
  period: currentPeriodId(),
  data: createSeed(),
  branchKpis: createBranchKpiSeed(),
  dailyActuals: {},
  branchDailyActuals: {},
  departmentDailyActuals: {},
  departmentTargets: {},
  branchKpiTargets: {},
  branchKpisByPeriod: {},
  hydrated: false,
  saveState: "idle",
  role: "staff",
  setRole: (r) => set({ role: r }),
  /**
   * يثبّت الدور من السيرفر فقط — كوكي جلسة Admin الموقّعة (HttpOnly). دور
   * الواجهة مجرد تلميح للمظهر؛ كل عملية كتابة تتحقق من الصلاحية على السيرفر
   * مرة أخرى عبر requireAdmin، فتغيير هذه الحالة محليًا لا يمنح أي صلاحية.
   */
  syncRole: async () => {
    try {
      const res = await getAdminSession();
      set({ role: res.isAdmin ? "manager" : "staff" });
    } catch {
      set({ role: "staff" });
    }
  },
  exitManager: () => set({ role: "staff" }),
  setView: (view) => set({ view }),
  setPeriod: (period) => {
    const currentBranchKpis = get().branchKpisByPeriod[period] ?? createBranchKpiSeed();
    markSaved();
    set({ period, branchKpis: currentBranchKpis });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
      get().branchKpiTargets,
      get().branchKpisByPeriod,
    );
    queueSharedSave(get);
  },
  setValue: (dep, kpi, field, value) => {
    const { period, data, role } = get();
    // prevent staff from modifying values
    if (role === "staff") return;
    const nextEntry: Entry = {
      ...data[period][dep][kpi],
      [field]: value,
    };
    const next: PerformanceData = {
      ...data,
      [period]: {
        ...data[period],
        [dep]: {
          ...data[period][dep],
          [kpi]: nextEntry,
        },
      },
    };
    markSaved();
    set({ data: next });
    persistLocal(
      period,
      next,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
      get().branchKpiTargets,
    );
    queueSave(period, dep, kpi, nextEntry, (saveState) => set({ saveState }));
    queueSharedSave(get);
  },
  setBranchValue: (kpi, field, value) => {
    if (get().role === "staff") return;
    const { period, branchKpisByPeriod } = get();
    const current = branchKpisByPeriod[period] ?? createBranchKpiSeed();
    const nextForPeriod: BranchKpiData = { ...current, [kpi]: { ...current[kpi], [field]: value } };
    const nextByPeriod: BranchKpiDataByPeriod = { ...branchKpisByPeriod, [period]: nextForPeriod };
    markSaved();
    set({ branchKpis: nextForPeriod, branchKpisByPeriod: nextByPeriod });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
      get().branchKpiTargets,
      nextByPeriod,
    );
    try {
      localStorage.setItem(`${STORAGE_KEY}:branch-kpis`, JSON.stringify(nextForPeriod));
    } catch {
      /* ignore quota / private mode */
    }
    queueSharedSave(get);
  },
  setDailyActual: (dep, kpi, date, value) => {
    const { period, data, dailyActuals, role } = get();
    if (role === "staff") return;
    const periodActuals = dailyActuals[period] ?? {};
    const depActuals = periodActuals[dep] ?? {};
    const kpiActuals = depActuals[kpi] ?? {};
    const nextDailyActuals: DailyActuals = {
      ...dailyActuals,
      [period]: {
        ...periodActuals,
        [dep]: { ...depActuals, [kpi]: { ...kpiActuals, [date]: value } },
      },
    };
    const total = Object.values({ ...kpiActuals, [date]: value }).reduce(
      (sum, current) => sum + current,
      0,
    );
    const next: PerformanceData = {
      ...data,
      [period]: {
        ...data[period],
        [dep]: {
          ...data[period][dep],
          [kpi]: { ...data[period][dep][kpi], result: total },
        },
      },
    };
    markSaved();
    set({ data: next, dailyActuals: nextDailyActuals });
    persistLocal(
      period,
      next,
      nextDailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
      get().branchKpiTargets,
    );
    queueSharedSave(get);
  },
  setBranchDailyActual: (kpi, date, value) => {
    if (get().role === "staff") return;
    const { period, branchDailyActuals, branchKpisByPeriod } = get();
    const next: BranchDailyActuals = {
      ...branchDailyActuals,
      [period]: {
        ...(branchDailyActuals[period] ?? {}),
        [kpi]: {
          ...(branchDailyActuals[period]?.[kpi] ?? {}),
          [date]: value,
        },
      },
    };
    const currentKpis = branchKpisByPeriod[period] ?? createBranchKpiSeed();
    const nextKpis: BranchKpiData = { ...currentKpis, [kpi]: { ...currentKpis[kpi], result: value } };
    const nextKpisByPeriod: BranchKpiDataByPeriod = { ...branchKpisByPeriod, [period]: nextKpis };
    markSaved();
    set({ branchDailyActuals: next, branchKpis: nextKpis, branchKpisByPeriod: nextKpisByPeriod });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      next,
      get().departmentDailyActuals,
      get().departmentTargets,
      get().branchKpiTargets,
      nextKpisByPeriod,
    );
    queueSharedSave(get);
  },
  setBranchKpiTarget: (kpi, value) => {
    if (get().role === "staff") return;
    const { period, branchKpiTargets, branchKpisByPeriod } = get();
    const nextTargets: BranchKpiTargets = {
      ...branchKpiTargets,
      [period]: {
        ...(branchKpiTargets[period] ?? {}),
        [kpi]: value,
      },
    };
    const currentKpis = branchKpisByPeriod[period] ?? createBranchKpiSeed();
    const nextKpis: BranchKpiData = { ...currentKpis, [kpi]: { ...currentKpis[kpi], plan: value } };
    const nextKpisByPeriod: BranchKpiDataByPeriod = { ...branchKpisByPeriod, [period]: nextKpis };
    markSaved();
    set({ branchKpiTargets: nextTargets, branchKpis: nextKpis, branchKpisByPeriod: nextKpisByPeriod });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
      nextTargets,
      nextKpisByPeriod,
    );
    queueSharedSave(get);
  },
  setDepartmentDailyActual: (dep, date, value) => {
    if (get().role === "staff") return;
    const { period, departmentDailyActuals } = get();
    const next: DepartmentDailyActuals = {
      ...departmentDailyActuals,
      [period]: {
        ...(departmentDailyActuals[period] ?? {}),
        [dep]: {
          ...(departmentDailyActuals[period]?.[dep] ?? {}),
          [date]: value,
        },
      },
    };
    markSaved();
    set({ departmentDailyActuals: next });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      next,
      get().departmentTargets,
      get().branchKpiTargets,
    );
    queueSharedSave(get);
  },
  setDepartmentTarget: (dep, value) => {
    if (get().role === "staff") return;
    const { period, departmentTargets } = get();
    const next: DepartmentTargets = {
      ...departmentTargets,
      [period]: {
        ...(departmentTargets[period] ?? {}),
        [dep]: value,
      },
    };
    markSaved();
    set({ departmentTargets: next });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      next,
      get().branchKpiTargets,
    );
    queueSharedSave(get);
  },
  saveBatchDaily: async ({
    period,
    date,
    depActuals,
    depTargets,
    kpiActuals,
    kpiTargets,
  }) => {
    if (get().role === "staff") return;
    const state = get();

    // 1. Department daily actuals
    const periodDepDaily = state.departmentDailyActuals[period] ?? {};
    const updatedDepDaily = { ...periodDepDaily };
    Object.entries(depActuals).forEach(([d, val]) => {
      const depKey = d as Dep;
      updatedDepDaily[depKey] = {
        ...(updatedDepDaily[depKey] ?? {}),
        [date]: val as number,
      };
    });
    const nextDepDaily: DepartmentDailyActuals = {
      ...state.departmentDailyActuals,
      [period]: updatedDepDaily,
    };

    // 2. Department targets
    const nextDepTargets: DepartmentTargets = depTargets
      ? {
          ...state.departmentTargets,
          [period]: {
            ...(state.departmentTargets[period] ?? {}),
            ...depTargets,
          },
        }
      : state.departmentTargets;

    // 3. KPI daily actuals
    const periodKpiDaily = state.branchDailyActuals[period] ?? {};
    const updatedKpiDaily = { ...periodKpiDaily };
    Object.entries(kpiActuals).forEach(([k, val]) => {
      const kpiKey = k as Kpi;
      updatedKpiDaily[kpiKey] = {
        ...(updatedKpiDaily[kpiKey] ?? {}),
        [date]: val as number,
      };
    });
    const nextKpiDaily: BranchDailyActuals = {
      ...state.branchDailyActuals,
      [period]: updatedKpiDaily,
    };

    // 4. KPI targets
    const nextKpiTargets: BranchKpiTargets = kpiTargets
      ? {
          ...state.branchKpiTargets,
          [period]: {
            ...(state.branchKpiTargets[period] ?? {}),
            ...kpiTargets,
          },
        }
      : state.branchKpiTargets;

    // 5. Update branchKpis summary
    const currentBranchKpis = state.branchKpisByPeriod[period] ?? createBranchKpiSeed();
    const nextBranchKpis = { ...currentBranchKpis };
    if (kpiTargets) {
      Object.entries(kpiTargets).forEach(([k, val]) => {
        const kpiKey = k as Kpi;
        if (nextBranchKpis[kpiKey]) {
          nextBranchKpis[kpiKey] = { ...nextBranchKpis[kpiKey], plan: val as number };
        }
      });
    }
    Object.entries(kpiActuals).forEach(([k, val]) => {
      const kpiKey = k as Kpi;
      if (nextBranchKpis[kpiKey]) {
        nextBranchKpis[kpiKey] = { ...nextBranchKpis[kpiKey], result: val as number };
      }
    });

    const nextBranchKpisByPeriod: BranchKpiDataByPeriod = { ...state.branchKpisByPeriod, [period]: nextBranchKpis };

    markSaved();
    set({
      departmentDailyActuals: nextDepDaily,
      departmentTargets: nextDepTargets,
      branchDailyActuals: nextKpiDaily,
      branchKpiTargets: nextKpiTargets,
      branchKpis: nextBranchKpis,
      branchKpisByPeriod: nextBranchKpisByPeriod,
    });

    persistLocal(
      period,
      state.data,
      state.dailyActuals,
      nextKpiDaily,
      nextDepDaily,
      nextDepTargets,
      nextKpiTargets,
      nextBranchKpisByPeriod,
    );

    await saveDashboardState({ data: sharedStateFromStore(get()) });
  },
  hydrate: async (silent = false) => {
    if (!silent && get().hydrated) return;
    // التحديث الدوري بعد حفظ حديث: قد تعيد استجابة قديمة وت مسح ما حفظه المستخدم
    if (silent && Date.now() - lastSaveAt < 10_000) return;
    const currentRole = get().role;
    try {
      const shared = await loadDashboardState();
      // السيرفر قد يحمل أسماء قديمة (مؤشرات أو أقسام) — رحّلها قبل الاستخدام
      migrateNames(shared);
      set({
        ...shared,
        branchKpiTargets: shared.branchKpiTargets ?? {},
        branchKpisByPeriod:
          shared.branchKpisByPeriod && Object.keys(shared.branchKpisByPeriod).length
            ? shared.branchKpisByPeriod
            : { [shared.period]: shared.branchKpis },
        branchKpis: shared.branchKpisByPeriod?.[shared.period] ?? shared.branchKpis,
        hydrated: true,
        role: currentRole,
      });
      persistLocal(
        shared.period,
        shared.data,
        shared.dailyActuals,
        shared.branchDailyActuals,
        shared.departmentDailyActuals,
        shared.departmentTargets,
        shared.branchKpiTargets ?? {},
        shared.branchKpisByPeriod?.[shared.period] ?? { [shared.period]: shared.branchKpis },
      );
      try {
        localStorage.setItem(`${STORAGE_KEY}:branch-kpis`, JSON.stringify(shared.branchKpisByPeriod?.[shared.period] ?? shared.branchKpis));
      } catch {
        /* local cache is optional */
      }
      return;
    } catch {
      // Keep the local cache available if the shared database is unavailable.
    }
    if (!silent) {
      const saved = readSaved();
      let branchKpis = createBranchKpiSeed();
      let branchKpisByPeriod: BranchKpiDataByPeriod = {};
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY}:branch-kpis`);
        if (raw) branchKpis = JSON.parse(raw) as BranchKpiData;
      } catch {
        /* use empty branch KPI targets */
      }
      if (saved) {
        branchKpisByPeriod = saved.branchKpisByPeriod ?? { [saved.period]: branchKpis };
        set({ ...saved, branchKpis: branchKpisByPeriod[saved.period] ?? branchKpis, branchKpisByPeriod, hydrated: true, role: currentRole });
        return;
      }
      persistLocal(
        get().period,
        get().data,
        get().dailyActuals,
        get().branchDailyActuals,
        get().departmentDailyActuals,
        get().departmentTargets,
        get().branchKpiTargets,
        get().branchKpisByPeriod,
      );
      set({ hydrated: true });
    }
  },
}));
