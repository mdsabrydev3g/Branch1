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
  type BranchKpiTargets,
} from "@/lib/domain";
import { saveKpiCell } from "@/lib/performance-api";
import { loadDashboardState, saveDashboardState } from "@/lib/dashboard-api";

const STORAGE_KEY = "fayoum-pcc-v2";
const STORAGE_VERSION = 4;

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
  branchKpiTargets: BranchKpiTargets;
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

function persistLocal(
  period: PeriodId,
  data: PerformanceData,
  dailyActuals: DailyActuals = {},
  branchDailyActuals: BranchDailyActuals = {},
  departmentDailyActuals: DepartmentDailyActuals = {},
  departmentTargets: DepartmentTargets = {},
  branchKpiTargets: BranchKpiTargets = {},
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
      branchKpiTargets: parsed.branchKpiTargets ?? {},
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
  branchKpiTargets: {},
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
      get().branchKpiTargets,
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
      get().branchKpiTargets,
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
      get().branchKpiTargets,
    );
    queueSharedSave(get);
  },
  setBranchDailyActual: (kpi, date, value) => {
    if (get().role === "staff") return;
    const { period, branchDailyActuals, branchKpis } = get();
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
    const nextKpis: BranchKpiData = {
      ...branchKpis,
      [kpi]: {
        ...branchKpis[kpi],
        result: value,
      },
    };
    set({ branchDailyActuals: next, branchKpis: nextKpis });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      next,
      get().departmentDailyActuals,
      get().departmentTargets,
      get().branchKpiTargets,
    );
    queueSharedSave(get);
  },
  setBranchKpiTarget: (kpi, value) => {
    if (get().role === "staff") return;
    const { period, branchKpiTargets, branchKpis } = get();
    const nextTargets: BranchKpiTargets = {
      ...branchKpiTargets,
      [period]: {
        ...(branchKpiTargets[period] ?? {}),
        [kpi]: value,
      },
    };
    const nextKpis: BranchKpiData = {
      ...branchKpis,
      [kpi]: {
        ...branchKpis[kpi],
        plan: value,
      },
    };
    set({ branchKpiTargets: nextTargets, branchKpis: nextKpis });
    persistLocal(
      period,
      get().data,
      get().dailyActuals,
      get().branchDailyActuals,
      get().departmentDailyActuals,
      get().departmentTargets,
      nextTargets,
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
    const nextBranchKpis = { ...state.branchKpis };
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

    set({
      departmentDailyActuals: nextDepDaily,
      departmentTargets: nextDepTargets,
      branchDailyActuals: nextKpiDaily,
      branchKpiTargets: nextKpiTargets,
      branchKpis: nextBranchKpis,
    });

    persistLocal(
      period,
      state.data,
      state.dailyActuals,
      nextKpiDaily,
      nextDepDaily,
      nextDepTargets,
      nextKpiTargets,
    );

    await saveDashboardState({ data: sharedStateFromStore(get()) });
  },
  hydrate: async (silent = false) => {
    if (!silent && get().hydrated) return;
    const currentRole = get().role;
    try {
      const shared = await loadDashboardState();
      set({
        ...shared,
        branchKpiTargets: shared.branchKpiTargets ?? {},
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
    if (!silent) {
      const saved = readSaved();
      let branchKpis = createBranchKpiSeed();
      try {
        const raw = localStorage.getItem(`${STORAGE_KEY}:branch-kpis`);
        if (raw) branchKpis = JSON.parse(raw) as BranchKpiData;
      } catch {
        /* use empty branch KPI targets */
      }
      if (saved) {
        set({ ...saved, branchKpis, hydrated: true, role: currentRole });
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
      );
      set({ hydrated: true });
    }
  },
}));
