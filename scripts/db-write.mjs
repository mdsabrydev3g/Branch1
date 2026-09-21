import { PGlite } from "@electric-sql/pglite";

const DEPS = ["TV", "AC", "MDA", "SDA", "Laptop", "Other", "Mobile", "ACC"];
const KPIS = ["Gross", "Agency", "BOXI", "Mylo", "CR", "GK", "Gift"];
const PERIODS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
const PERIOD = "2026-09";

const DEP_TARGETS = { TV: 1771530, AC: 687210, MDA: 7866000, SDA: 1685190, "Mobile": 7757760, "Other": 30780, "Laptop": 718800, "ACC": 238170 };
const KPI_TARGETS = { Gross: 20755410, Agency: 1500000, Mylo: 8208660, BOXI: 194277, Gift: 65128, CR: 20, GK: 400 };
const DEP_H1 = { TV: 606118, AC: 122348, MDA: 2051337, SDA: 520011, "Mobile": 5203411, "Other": 1934, "Laptop": 220353, "ACC": 76039 };
const KPI_H1 = { Gross: 8801551, Agency: 630460, Mylo: 3459924, BOXI: 95844, Gift: 42000, CR: 21, GK: 130 };
const DEP_H2 = { TV: 752254, AC: 135816, MDA: 2629623, SDA: 640074, "Mobile": 7080585, "Other": 24009, "Laptop": 258948, "ACC": 87225 };
const KPI_H2 = { Gross: 11608532, Agency: 766591, Mylo: 4355773, BOXI: 128212, Gift: 42000, CR: 21, GK: 135 };

const emptyDept = () => Object.fromEntries(KPIS.map((k) => [k, { plan: 0, result: 0 }]));
const data = {};
for (const p of PERIODS) data[p] = Object.fromEntries(DEPS.map((d) => [d, emptyDept()]));

const state = {
  period: PERIOD,
  data,
  branchKpis: Object.fromEntries(KPIS.map((k) => [k, { plan: KPI_TARGETS[k], result: KPI_H2[k] }])),
  dailyActuals: {},
  branchDailyActuals: { [PERIOD]: Object.fromEntries(KPIS.map((k) => [k, { "2026-09-15": KPI_H1[k], "2026-09-19": KPI_H2[k] }])) },
  departmentDailyActuals: { [PERIOD]: Object.fromEntries(DEPS.map((d) => [d, { "2026-09-15": DEP_H1[d], "2026-09-19": DEP_H2[d] }])) },
  departmentTargets: { [PERIOD]: { ...DEP_TARGETS } },
  branchKpiTargets: { [PERIOD]: { ...KPI_TARGETS } },
};

const json = JSON.stringify(state);

const pg = new PGlite({ dataDir: ".pglite-data" });
await pg.waitReady;
const sql = pg.query.bind(pg);
await sql(
  `insert into dashboard_state (state_key, state, updated_at)
   values ('main', $1::jsonb, now())
   on conflict (state_key) do update set state = excluded.state, updated_at = now()`,
  [json],
);
const rows = await sql(
  `select state from dashboard_state where state_key='main'`,
);
const st = rows.rows[0]?.state;
console.log("period:", st?.period);
console.log("dep targets:", JSON.stringify(st?.departmentTargets?.["2026-09"]));
console.log("kpi targets:", JSON.stringify(st?.branchKpiTargets?.["2026-09"]));
console.log("Gross H2:", st?.branchDailyActuals?.["2026-09"]?.Gross?.["2026-09-19"]);
console.log("TV H2:", st?.departmentDailyActuals?.["2026-09"]?.TV?.["2026-09-19"]);
console.log("CR result:", st?.branchKpis?.CR?.result);
await pg.close();
