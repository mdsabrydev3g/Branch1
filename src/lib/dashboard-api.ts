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
import { createBranchKpiSeed, createSeed, currentPeriodId } from "@/lib/domain";
import { requireAdmin } from "@/lib/auth/roles.server";

export type SharedDashboardState = {
  revision: number;
  period: PeriodId;
  data: PerformanceData;
  branchKpis: BranchKpiData;
  branchKpisByPeriod: Partial<Record<PeriodId, BranchKpiData>>;
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
  branchKpisByPeriod: z.record(z.string(), z.unknown()).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});

function defaultState(): SharedDashboardState {
  return {
    revision: 0,
    period: currentPeriodId(),
    data: createSeed(),
    branchKpis: createBranchKpiSeed(),
    dailyActuals: {},
    branchDailyActuals: {},
    departmentDailyActuals: {},
    departmentTargets: {},
    branchKpiTargets: {},
    branchKpisByPeriod: {},
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

/**
 * يُعلِم كل الأجهزة المتصلة بأن الحالة المشتركة تغيّرت: العملاء المتصلون بنفس
 * نسخة السيرفر يستلمون التغيير فورًا (بدون أي قراءة من قاعدة البيانات)، وبقية
 * النسخ تلتقطه عبر مؤقّت رقم النسخة (rev).
 *
 * تعمل بأفضل جهد فقط: لا يجوز أن يفشل حفظ المدير بسبب طبقة التزامن.
 */
async function publishChange(revision: number, state: unknown): Promise<void> {
  try {
    const { publishState } = await import("@/lib/realtime/hub.server");
    publishState(revision, state);
  } catch {
    /* realtime is an enhancement, never a write dependency */
  }
}

export const loadDashboardState = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ state: unknown; revision: number }>`
    select state, revision from dashboard_state where state_key = 'main'
  `;
  if (!rows[0]) return defaultState();
  return { ...parseState(rows[0].state), revision: Number(rows[0].revision) || 1 };
});

export const saveDashboardState = createServerFn({ method: "POST" })
  .validator(stateSchema)
  .handler(async ({ data }) => {
    // Write operations require a valid ADMIN session — verified server-side
    // from the signed HttpOnly cookie, never from the client.
    await requireAdmin();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { expectedRevision, ...stateData } = data;

    if (expectedRevision === undefined) {
      // Migration/maintenance callers may still write without a revision.
      // Normal browser writes always provide expectedRevision.
      await sql`
        insert into dashboard_state (state_key, state, revision, updated_at)
        values ('main', ${JSON.stringify(stateData)}::jsonb, 1, now())
        on conflict (state_key) do update set
          state = excluded.state,
          revision = dashboard_state.revision + 1,
          updated_at = now()
      `;
      const rows = await sql<{ revision: number }>`
        select revision from dashboard_state where state_key = 'main'
      `;
      const revision = Number(rows[0]?.revision) || 1;
      await publishChange(revision, stateData);
      return { ok: true as const, revision };
    }

    if (expectedRevision === 0) {
      const inserted = await sql<{ revision: number }>`
        insert into dashboard_state (state_key, state, revision, updated_at)
        values ('main', ${JSON.stringify(stateData)}::jsonb, 1, now())
        on conflict (state_key) do nothing
        returning revision
      `;
      if (inserted[0]) {
        const revision = Number(inserted[0].revision);
        await publishChange(revision, stateData);
        return { ok: true as const, revision };
      }
    }

    const rows = await sql<{ revision: number }>`
      update dashboard_state
      set state = ${JSON.stringify(stateData)}::jsonb,
          revision = revision + 1,
          updated_at = now()
      where state_key = 'main' and revision = ${expectedRevision}
      returning revision
    `;

    if (!rows[0]) {
      return { ok: false as const, conflict: true as const };
    }

    const revision = Number(rows[0].revision);
    await publishChange(revision, stateData);
    return { ok: true as const, revision };
  });
