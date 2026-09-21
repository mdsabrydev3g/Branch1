import { PGlite } from "@electric-sql/pglite";

const RENAMED_DEPS = {
  "IT Laptop": "Laptop",
  "IT Other": "Other",
  "Telecom Mobile": "Mobile",
  "Telecom ACC": "ACC",
};

const pg = new PGlite({ dataDir: ".pglite-data" });
await pg.waitReady;
const sql = pg.query.bind(pg);

const rows = await sql("select state from dashboard_state where state_key = 'main'");
const st = rows.rows[0]?.state;
if (!st) {
  console.log("NO ROW — nothing to migrate");
  await pg.close();
  process.exit(0);
}

let changed = 0;
const applyDeps = (map) => {
  if (!map || typeof map !== "object") return;
  for (const [oldKey, newKey] of Object.entries(RENAMED_DEPS)) {
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

if (st.data) for (const period of Object.keys(st.data)) applyDeps(st.data[period]);
if (st.departmentDailyActuals) for (const p of Object.keys(st.departmentDailyActuals)) applyDeps(st.departmentDailyActuals[p]);
if (st.departmentTargets) for (const p of Object.keys(st.departmentTargets)) applyDeps(st.departmentTargets[p]);

await sql(
  `update dashboard_state set state = $1::jsonb, updated_at = now() where state_key = 'main'`,
  [JSON.stringify(st)],
);

console.log("migrated keys:", changed);
console.log("dep targets now:", JSON.stringify(st.departmentTargets?.["2026-09"]));
console.log("TV H2:", st.departmentDailyActuals?.["2026-09"]?.TV?.["2026-09-19"]);
console.log("Mobile H2:", st.departmentDailyActuals?.["2026-09"]?.Mobile?.["2026-09-19"]);
await pg.close();
