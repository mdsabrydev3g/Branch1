import { create } from "zustand";
import { toast } from "sonner";
import {
  createSeed,
  currentPeriodId,
  createBranchKpiSeed,
  ensurePeriodBlocks,
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
import {
  loadDashboardState,
  saveDashboardState,
  type SharedDashboardState,
} from "@/lib/dashboard-api";
import { describeDashboardChange, showSystemUpdateNotification } from "@/lib/notifications";

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
  setBranchKpiTarget: (kpi: Kpi, value: number) => void;
  setDepartmentDailyActual: (dep: Dep, date: string, value: number) => void;
  setDepartmentTarget: (dep: Dep, value: number) => void;
  saveMonthlyKpiActuals: (params: { period: PeriodId; actuals: Partial<Record<Kpi, number>> }) => Promise<void>;
  saveMonthlyTargets: (params: {
    period: PeriodId;
    depTargets: Partial<Record<Dep, number>>;
    kpiTargets: Partial<Record<Kpi, number>>;
  }) => Promise<void>;
  saveBatchDaily: (params: {
    period: PeriodId;
    date: string;
    // null explicitly deletes the reading for this date.
    depActuals: Partial<Record<Dep, number | null>>;
    depTargets?: Partial<Record<Dep, number>>;
    // null explicitly deletes the reading for this date.
    kpiActuals: Partial<Record<Kpi, number | null>>;
    kpiTargets?: Partial<Record<Kpi, number>>;
  }) => Promise<void>;
  hydrate: (silent?: boolean) => Promise<void>;
  /**
   * يطبّق حالة وصلت من قناة التزامن (SSE) فورًا: بدون إعادة تحميل للصفحة وبدون
   * طلب شبكة إضافي، لأن الحالة نفسها تصل داخل الحدث.
   */
  applyRemote: (shared: unknown) => void;
  /** يسحب أحدث حالة من السيرفر ويطبّقها إن كانت أحدث مما لدينا. */
  syncRemote: () => Promise<void>;
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
let sharedRevision = 0;

/**
 * عدد الكتابات المشتركة الجارية الآن. نؤجّل تطبيق تحديث قادم من جهاز آخر
 * أثناءها حتى لا يرتد ما كتبه المستخدم للتو في الواجهة قبل تأكيد الحفظ.
 */
let sharedWritesInFlight = 0;
let deferredRemoteApply = false;

/**
 * المسار الواحد لكل كتابة على الحالة المشتركة: يحفظ، ويحدّث رقم النسخة،
 * ويتعامل مع تعارض الأجهزة، ويعاود سحب أي تحديث وصل أثناء الحفظ.
 */
async function writeSharedState(
  get: () => PerfState,
  set: (partial: Partial<PerfState> | ((state: PerfState) => Partial<PerfState>)) => void,
  data: Parameters<typeof saveDashboardState>[0]["data"],
  options: { throwOnConflict?: boolean } = {},
) {
  sharedWritesInFlight += 1;
  try {
    const result = await saveDashboardState({ data, expectedRevision: sharedRevision } as Parameters<typeof saveDashboardState>[0] & { expectedRevision: number });
    if (result.ok) {
      sharedRevision = result.revision;
      return result;
    }
    await applySharedConflict(get, set);
    if (options.throwOnConflict) {
      throw new Error(
        "Dashboard changed on another device. The latest data was loaded; please review and save again.",
      );
    }
    return result;
  } finally {
    sharedWritesInFlight -= 1;
    if (sharedWritesInFlight === 0 && deferredRemoteApply) {
      deferredRemoteApply = false;
      void get().syncRemote();
    }
  }
}

function queueSharedSave(
  get: () => PerfState,
  set: (partial: Partial<PerfState> | ((state: PerfState) => Partial<PerfState>)) => void,
) {
  if (sharedSaveTimer) clearTimeout(sharedSaveTimer);
  sharedSaveTimer = setTimeout(() => {
    void writeSharedState(get, set, sharedStateFromStore(get()));
  }, 300);
}

async function applySharedConflict(
  get: () => PerfState,
  set: (partial: Partial<PerfState> | ((state: PerfState) => Partial<PerfState>)) => void,
) {
  try {
    const fresh = await loadDashboardState();
    migrateNames(fresh);
    sharedRevision = fresh.revision;
    set({
      ...fresh,
      branchKpiTargets: fresh.branchKpiTargets ?? {},
      branchKpisByPeriod:
        fresh.branchKpisByPeriod && Object.keys(fresh.branchKpisByPeriod).length
          ? fresh.branchKpisByPeriod
          : { [fresh.period]: fresh.branchKpis },
      branchKpis: fresh.branchKpisByPeriod?.[fresh.period] ?? fresh.branchKpis,
      hydrated: true,
      role: get().role,
      saveState: "error",
    });
  } catch {
    set({ saveState: "error" });
  }
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
      // كتل الفترات الناقصة (localStorage قديم) تُملأ فارغة — حتى لا ينهار
      // العرض عند اختيار شهر لا وجود له في النسخة المخزنة.
      data: ensurePeriodBlocks(parsed.data),
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

/**
 * يطبّق حالة مشتركة (من السيرفر أو من قناة التزامن) على المخزن بعد تطبيعها.
 * مسار واحد لكل حالة قادمة من الخارج — فلا يختلف سلوك التزامن عن hydrate:
 * نفس ترحيل الأسماء القديمة، ونفس القيم الافتراضية، ونفس الكاش المحلي.
 */
function applySharedToStore(
  shared: SharedDashboardState,
  get: () => PerfState,
  set: (partial: Partial<PerfState> | ((state: PerfState) => Partial<PerfState>)) => void,
): void {
  // السيرفر قد يحمل أسماء قديمة (مؤشرات أو أقسام) — رحّلها قبل الاستخدام
  migrateNames(shared);
  const branchKpisByPeriod =
    shared.branchKpisByPeriod && Object.keys(shared.branchKpisByPeriod).length
      ? shared.branchKpisByPeriod
      : { [shared.period]: shared.branchKpis };
  const branchKpis = shared.branchKpisByPeriod?.[shared.period] ?? shared.branchKpis;

  set({
    ...shared,
    // كل فترة مدعومة لها كتلة (الحالة القديمة من السيرفر قد تحمل شهوراً ناقصة)
    data: ensurePeriodBlocks(shared.data),
    branchKpiTargets: shared.branchKpiTargets ?? {},
    branchKpisByPeriod,
    branchKpis,
    hydrated: true,
    role: get().role,
  });

  persistLocal(
    shared.period,
    shared.data,
    shared.dailyActuals,
    shared.branchDailyActuals,
    shared.departmentDailyActuals,
    shared.departmentTargets,
    shared.branchKpiTargets ?? {},
    branchKpisByPeriod,
  );

  try {
    localStorage.setItem(`${STORAGE_KEY}:branch-kpis`, JSON.stringify(branchKpis));
  } catch {
    /* local cache is optional */
  }
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
    queueSharedSave(get, set);
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
      get().branchKpisByPeriod,
    );
    queueSave(period, dep, kpi, nextEntry, (saveState) => set({ saveState }));
    queueSharedSave(get, set);
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
    queueSharedSave(get, set);
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
      get().branchKpisByPeriod,
    );
    queueSharedSave(get, set);
  },
  setBranchKpiTarget: (kpi: Kpi, value: number) => {
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
    queueSharedSave(get, set);
  },
  saveMonthlyTargets: async ({ period, depTargets, kpiTargets }) => {
    if (get().role === "staff") return;
    const state = get();

    const nextDepartmentTargets: DepartmentTargets = {
      ...state.departmentTargets,
      [period]: {
        ...(state.departmentTargets[period] ?? {}),
        ...depTargets,
      },
    };

    const nextBranchKpiTargets: BranchKpiTargets = {
      ...state.branchKpiTargets,
      [period]: {
        ...(state.branchKpiTargets[period] ?? {}),
        ...kpiTargets,
      },
    };

    const currentKpis = state.branchKpisByPeriod[period] ?? createBranchKpiSeed();
    const nextKpis = { ...currentKpis };
    for (const [k, value] of Object.entries(kpiTargets)) {
      const kpi = k as Kpi;
      if (nextKpis[kpi]) {
        nextKpis[kpi] = { ...nextKpis[kpi], plan: value as number };
      }
    }
    const nextByPeriod: BranchKpiDataByPeriod = {
      ...state.branchKpisByPeriod,
      [period]: nextKpis,
    };

    markSaved();
    set({
      departmentTargets: nextDepartmentTargets,
      branchKpiTargets: nextBranchKpiTargets,
      branchKpis: nextKpis,
      branchKpisByPeriod: nextByPeriod,
    });

    persistLocal(
      period,
      state.data,
      state.dailyActuals,
      state.branchDailyActuals,
      state.departmentDailyActuals,
      nextDepartmentTargets,
      nextBranchKpiTargets,
      nextByPeriod,
    );

    await writeSharedState(get, set, sharedStateFromStore(get()), { throwOnConflict: true });
  },
  saveMonthlyKpiActuals: async ({ period, actuals }) => {
    if (get().role === "staff") return;
    const state = get();
    const currentKpis = state.branchKpisByPeriod[period] ?? createBranchKpiSeed();
    const nextKpis = { ...currentKpis };
    for (const [k, value] of Object.entries(actuals)) {
      const kpi = k as Kpi;
      if (nextKpis[kpi]) nextKpis[kpi] = { ...nextKpis[kpi], result: value as number };
    }
    const nextByPeriod: BranchKpiDataByPeriod = { ...state.branchKpisByPeriod, [period]: nextKpis };
    markSaved();
    set({ branchKpis: nextKpis, branchKpisByPeriod: nextByPeriod });
    persistLocal(
      period,
      state.data,
      state.dailyActuals,
      state.branchDailyActuals,
      state.departmentDailyActuals,
      state.departmentTargets,
      state.branchKpiTargets,
      nextByPeriod,
    );
    await writeSharedState(get, set, sharedStateFromStore(get()), { throwOnConflict: true });
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
      get().branchKpisByPeriod,
    );
    queueSharedSave(get, set);
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
      get().branchKpisByPeriod,
    );
    queueSharedSave(get, set);
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
      const current = { ...(updatedDepDaily[depKey] ?? {}) };
      if (val === null) delete current[date];
      else current[date] = val as number;
      if (Object.keys(current).length) updatedDepDaily[depKey] = current;
      else delete updatedDepDaily[depKey];
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
      const current = { ...(updatedKpiDaily[kpiKey] ?? {}) };
      if (val === null) delete current[date];
      else current[date] = val as number;
      if (Object.keys(current).length) updatedKpiDaily[kpiKey] = current;
      else delete updatedKpiDaily[kpiKey];
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

    // 5. Keep monthly KPI values independent from daily readings.
    // Daily entries are displayed from branchDailyActuals; monthly actuals are edited separately.
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

    await writeSharedState(get, set, sharedStateFromStore(get()), { throwOnConflict: true });
  },
  /**
   * يطبّق حالة وصلت من قناة التزامن فورًا. الحراس هنا مهمّان:
   *  - حالة غير قابلة للعرض (بلا قسم للفترة الحالية) لا تلمس الواجهة.
   *  - نسخة أحدث فقط هي التي تُطبَّق (كل كتابة تزيد revision على السيرفر).
   *  - أثناء كتابة محلية لم تُؤكَّد بعد نؤجّل التطبيق ثم نعاود السحب، حتى لا
   *    يرتد ما كتبه المستخدم للتو على الشاشة قبل أن يُحفظ.
   */
  applyRemote: (raw) => {
    if (!raw || typeof raw !== "object") return;
    const shared = raw as SharedDashboardState;
    if (!shared.period || !shared.data || !shared.data[shared.period]) return;
    const revision = Number(shared.revision) || 0;
    if (revision > 0 && revision <= sharedRevision) return;
    if (sharedWritesInFlight > 0) {
      deferredRemoteApply = true;
      return;
    }
    if (revision > 0) sharedRevision = revision;
    // exclude this tab's own save echo: sharedRevision is advanced before
    // the server publishes the write, so only genuinely newer remote revisions
    // reach this branch and produce a notification for other operators.
    // Do not notify for the initial state delivered when a fresh client connects.
    if (get().hydrated) {
      const previous = {
        data: get().data,
        branchKpis: get().branchKpisByPeriod,
        branchDailyActuals: get().branchDailyActuals,
        departmentDailyActuals: get().departmentDailyActuals,
        departmentTargets: get().departmentTargets,
        branchKpiTargets: get().branchKpiTargets,
      };
      const description = describeDashboardChange(previous, shared);
      toast("تم تحديث البيانات", {
        description: `${description} — تم تطبيق التعديل من جهاز آخر.`,
        duration: 6500,
        action: { label: "عرض", onClick: () => usePerfStore.getState().setView("overview") },
      });
      void showSystemUpdateNotification("تحديث جديد في Branch1", `${description}\nتم تطبيقه من جهاز آخر.`);
    }
    applySharedToStore(shared, get, set);
  },
  /**
   * سحب متعمّد لأحدث حالة: يُستخدم عند العودة إلى الواجهة بعد الخلفية أو
   * الانقطاع، وعندما يصل حدث تزامن بلا حالة مرفقة.
   */
  syncRemote: async () => {
    try {
      const shared = await loadDashboardState();
      if (shared.revision <= sharedRevision) return;
      get().applyRemote(shared);
    } catch {
      // السيرفر/الشبكة غير متاحة الآن: نُبقي ما لدينا وننتظر إعادة الاتصال.
    }
  },
  hydrate: async (silent = false) => {
    if (!silent && get().hydrated) return;
    // التحديث الدوري بعد حفظ حديث: قد تعيد استجابة قديمة وت مسح ما حفظه المستخدم
    if (silent && Date.now() - lastSaveAt < 10_000) return;
    const currentRole = get().role;
    try {
      const shared = await loadDashboardState();
      sharedRevision = shared.revision;
      applySharedToStore(shared, get, set);
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
