import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  BranchDailyActuals,
  BranchKpiData,
  DailyActuals,
  DepartmentDailyActuals,
  DepartmentTargets,
  PerformanceData,
  PeriodId,
} from "@/lib/domain";
import { createBranchKpiSeed, createSeed } from "@/lib/domain";

export type SharedDashboardState = {
  period: PeriodId;
  data: PerformanceData;
  branchKpis: BranchKpiData;
  dailyActuals: DailyActuals;
  branchDailyActuals: BranchDailyActuals;
  departmentDailyActuals: DepartmentDailyActuals;
  departmentTargets: DepartmentTargets;
};

const stateSchema = z.object({
  period: z.string(),
  data: z.record(z.string(), z.unknown()),
  branchKpis: z.record(z.string(), z.unknown()),
  dailyActuals: z.record(z.string(), z.unknown()),
  branchDailyActuals: z.record(z.string(), z.unknown()),
  departmentDailyActuals: z.record(z.string(), z.unknown()),
  departmentTargets: z.record(z.string(), z.unknown()),
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
  };
}

function parseState(value: unknown): SharedDashboardState {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) return defaultState();
  return parsed.data as SharedDashboardState;
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
