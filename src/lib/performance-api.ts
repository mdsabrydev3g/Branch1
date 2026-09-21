import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createSeed,
  DEPS,
  KPIS,
  PERIODS,
  type Dep,
  type Kpi,
  type PerformanceData,
  type PeriodId,
} from "@/lib/domain";

const periodIds = PERIODS.map((p) => p.id) as [PeriodId, ...PeriodId[]];
const deps = [...DEPS] as [Dep, ...Dep[]];
const kpis = [...KPIS] as [Kpi, ...Kpi[]];

const cellInput = z.object({
  period: z.enum(periodIds),
  dept: z.enum(deps),
  kpi: z.enum(kpis),
  plan: z.number().int().nonnegative(),
  result: z.number().int().nonnegative(),
});

type KpiRow = {
  period_id: string;
  dept: string;
  kpi: string;
  plan: number | string;
  result: number | string;
};

function emptyData(): PerformanceData {
  return createSeed();
}

function applyRows(rows: KpiRow[]): PerformanceData {
  const data = emptyData();
  for (const row of rows) {
    const period = row.period_id as PeriodId;
    const dept = row.dept as Dep;
    const kpi = row.kpi as Kpi;
    if (!data[period]?.[dept]?.[kpi]) continue;
    data[period][dept][kpi] = {
      plan: Number(row.plan) || 0,
      result: Number(row.result) || 0,
    };
  }
  return data;
}

async function seedIfEmpty(
  sql: {
    query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
  } & (<T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>),
) {
  const count = await sql<{ n: number }>`select count(*)::int as n from kpi_entries`;
  if ((count[0]?.n ?? 0) > 0) return;

  const seed = createSeed();
  const tuples: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const period of PERIODS) {
    for (const dept of DEPS) {
      for (const kpi of KPIS) {
        const cell = seed[period.id][dept][kpi];
        tuples.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
        params.push(period.id, dept, kpi, cell.plan, cell.result);
      }
    }
  }
  await sql.query(
    `insert into kpi_entries (period_id, dept, kpi, plan, result)
     values ${tuples.join(",")}
     on conflict (period_id, dept, kpi) do nothing`,
    params,
  );
}

export const loadKpis = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await seedIfEmpty(sql);
  const rows = await sql<KpiRow>`
    select period_id, dept, kpi, plan, result from kpi_entries
  `;
  return applyRows(rows);
});

export const saveKpiCell = createServerFn({ method: "POST" })
  .validator(cellInput)
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into kpi_entries (period_id, dept, kpi, plan, result, updated_at)
      values (${data.period}, ${data.dept}, ${data.kpi}, ${data.plan}, ${data.result}, now())
      on conflict (period_id, dept, kpi) do update set
        plan = excluded.plan,
        result = excluded.result,
        updated_at = now()
    `;
    return { ok: true as const };
  });
