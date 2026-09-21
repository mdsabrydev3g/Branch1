import { PGlite } from "@electric-sql/pglite";
const pg = new PGlite({ dataDir: ".pglite-data" });
const rows = await pg.query("select state from dashboard_state where state_key = 'main'");
await pg.close();
const st = rows.rows[0]?.state;
if (!st) { console.log("NO ROW"); process.exit(0); }
console.log("keys:", Object.keys(st));
console.log("period:", st.period);
console.log("branchKpis:", JSON.stringify(st.branchKpis, null, 1));
console.log("depDaily:", JSON.stringify(st.departmentDailyActuals, null, 1));
console.log("kpiDaily:", JSON.stringify(st.branchDailyActuals, null, 1));
console.log("depTargets:", JSON.stringify(st.departmentTargets, null, 1));
console.log("kpiTargets:", JSON.stringify(st.branchKpiTargets, null, 1));
console.log("data TV sample:", JSON.stringify(st.data?.[st.period]?.TV));
