import { create } from "zustand";
import {
  createSeed,
  createBranchKpiSeed,
  type BranchKpiData,
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
} from "@/lib/domain";
import { saveKpiCell } from "@/lib/performance-api";
import { loadDashboardState, saveDashboardState } from "@/lib/dashboard-api";

const STORAGE_KEY = "fayoum-pcc-v2";
const STORAGE_VERSION = 3;

type Field = keyof Entry;
export type SaveState = "idle" | "saving" | "saved" | "error";

export type Role = "manager" | "staff";

interface PerfState {
  view: ViewId;
  period: PeriodId;
  data: PerformanceData;
  branchKpis: BranchKpiData;
  dailyActuals: DailyActuals;
  branchDailyActuals: BranchDailyActuals;
  departmentDailyActuals: DepartmentDailyActuals;
  departmentTargets: DepartmentTargets;
  hydrated: boolean;
  saveState: SaveState;
  role: Role;
  setRole: (r: Role) => void;
  setView: (view: ViewId) => void;
  setPeriod: (period: PeriodId) => void;
  setValue: (dep: Dep, kpi: Kpi, field: Field, value: number) => void;
  setBranchValue: (kpi: Kpi, field: Field, value: number) => void;
  setDailyActual: (dep: Dep, kpi: Kpi, date: string, value: number) => void;
  setBranchDailyActual: (kpi: Kpi, date: string, value: number) => void;
  setDepartmentDailyActual: (dep: Dep, date: string, value: number) => void;
  setDepartmentTarget: (dep: Dep, value: number) => void;
  hydrate: () => Promise<void>;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function persistLocal(
  period: PeriodId,
  data: PerformanceData,
  dailyActuals: DailyActuals = {},
  branchDailyActuals: BranchDailyActuals = {},
  departmentDailyActuals: DepartmentDailyActuals = {},
  departmentTargets: DepartmentTargets = {},
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
>): Parameters<typeof saveDashboardState>[0]["data"] {
  return {
    period: state.period,
    data: state.data,
    branchKpis: state.branchKpis,
    dailyActuals: state.dailyActuals,
    branchDailyActuals: state.branchDailyActuals,
    departmentDailyActuals: state.departmentDailyActuals,
    departmentTargets: state.departmentTargets,
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
      version?: number;
    };
    if (!parsed.data || !parsed.period || parsed.version !== STORAGE_VERSION) return null;
    return {
      period: parsed.period,
      data: parsed.data,
      dailyActuals: parsed.dailyActuals ?? {},
      branchDailyActuals: parsed.branchDailyActuals ?? {},
      departmentDailyActuals: parsed.departmentDailyActuals ?? {},
      departmentTargets: parsed.departmentTargets ?? {},
    };
  } catch {
    return null;
  }
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
  period: "2026-09",
  data: createSeed(),
  branchKpis: createBranchKpiSeed(),
  dailyActuals: {},
  branchDailyActuals: {},
  departmentDailyActuals: {},
  departmentTargets: {},
  hydrated: false,
  saveState: "idle",
  role: "staff",
  setRole: (r) => set({ role: r }),
  setView: (view) => set({ view }),
  setPeriod: (period) => {
    set({ period });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
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
    set({ data: next });
    persistLocal(
      period,
      next,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
    );
    queueSave(period, dep, kpi, nextEntry, (saveState) => set({ saveState }));
    queueSharedSave(get);
  },
  setBranchValue: (kpi, field, value) => {
    if (get().role === "staff") return;
    const branchKpis = {
      ...get().branchKpis,
      [kpi]: { ...get().branchKpis[kpi], [field]: value },
    };
    set({ branchKpis });
    try {
      localStorage.setItem(`${STORAGE_KEY}:branch-kpis`, JSON.stringify(branchKpis));
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
    set({ data: next, dailyActuals: nextDailyActuals });
    persistLocal(
      period,
      next,
      nextDailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
    );
    queueSharedSave(get);
  },
  setBranchDailyActual: (kpi, date, value) => {
    if (get().role === "staff") return;
    const { period, branchDailyActuals } = get();
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
    set({ branchDailyActuals: next });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      next,
      get().departmentDailyActuals,
      get().departmentTargets,
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
    set({ departmentDailyActuals: next });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      next,
      get().departmentTargets,
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
    set({ departmentTargets: next });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      next,
    );
    queueSharedSave(get);
  },
  hydrate: async () => {
    if (get().hydrated) return;
    const saved = readSaved();
    let branchKpis = createBranchKpiSeed();
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:branch-kpis`);
      if (raw) branchKpis = JSON.parse(raw) as BranchKpiData;
    } catch {
      /* use empty branch KPI targets */
    }
    try {
      const shared = await loadDashboardState();
      set({ ...shared, hydrated: true, role: "staff" });
      persistLocal(
        shared.period,
        shared.data,
        shared.dailyActuals,
        shared.branchDailyActuals,
        shared.departmentDailyActuals,
        shared.departmentTargets,
      );
      try {
        localStorage.setItem(`${STORAGE_KEY}:branch-kpis`, JSON.stringify(shared.branchKpis));
      } catch {
        /* local cache is optional */
      }
      return;
    } catch {
      // Keep the local cache available if the shared database is unavailable.
    }
    if (saved) {
      set({ ...saved, branchKpis, hydrated: true, role: "staff" });
      return;
    }
    persistLocal(
      get().period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
    );
    set({ hydrated: true });
  },
}));
