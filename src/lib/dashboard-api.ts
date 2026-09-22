import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  BranchDailyActuals,
  BranchKpiData,
  DailyActuals,
  DepartmentDailyActuals,
  DepartmentTargets,
  BranchKpiTargets,
  PerformanceData,
  PeriodId,
} from "@/lib/domain";
import { createBranchKpiSeed, createSeed } from "@/lib/domain";
import { requireAdmin } from "@/lib/auth/roles.server";

export type SharedDashboardState = {
  period: PeriodId;
  data: PerformanceData;
  branchKpis: BranchKpiData;
  dailyActuals: DailyActuals;
  branchDailyActuals: BranchDailyActuals;
  departmentDailyActuals: DepartmentDailyActuals;
  departmentTargets: DepartmentTargets;
  branchKpiTargets?: BranchKpiTargets;
};

const stateSchema = z.object({
  period: z.string(),
  data: z.record(z.string(), z.unknown()),
  branchKpis: z.record(z.string(), z.unknown()),
  dailyActuals: z.record(z.string(), z.unknown()),
  branchDailyActuals: z.record(z.string(), z.unknown()),
  departmentDailyActuals: z.record(z.string(), z.unknown()),
  departmentTargets: z.record(z.string(), z.unknown()),
  branchKpiTargets: z.record(z.string(), z.unknown()).optional(),
});

function defaultState(): SharedDashboardState {
  return {
    period: "2026-09",
    data: createSeed(),
    branchKpis: createBranchKpiSeed(),
    dailyActuals: {},
    branchDailyActuals: {},
    departmentDailyActuals: {},
    departmentTargets: {},
    branchKpiTargets: {},
  };
}

/**
 * A stored state can pass the (loose, record-based) schema yet still be
 * unusable at runtime — e.g. `data: {}` with no entry for the current period
 * makes `data[period][dep][kpi]` undefined and the overview crashes on render.
 * Requiring the period block here keeps a corrupted row from white-screening
 * the whole app; the dashboard falls back to the seed instead.
 */
function isRenderable(state: SharedDashboardState): boolean {
  return Boolean(state.data?.[state.period]);
}

function parseState(value: unknown): SharedDashboardState {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) return defaultState();
  const state = parsed.data as SharedDashboardState;
  return isRenderable(state) ? state : defaultState();
}

export const loadDashboardState = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ state: unknown }>`
    select state from dashboard_state where state_key = 'main'
  `;
  return rows[0] ? parseState(rows[0].state) : defaultState();
});

export const saveDashboardState = createServerFn({ method: "POST" })
  .validator(stateSchema)
  .handler(async ({ data }) => {
    // Write operations require a valid ADMIN session — verified server-side
    // from the signed HttpOnly cookie, never from the client.
    await requireAdmin();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into dashboard_state (state_key, state, updated_at)
      values ('main', ${JSON.stringify(data)}::jsonb, now())
      on conflict (state_key) do update set
        state = excluded.state,
        updated_at = now()
    `;
    return { ok: true as const };
  });
