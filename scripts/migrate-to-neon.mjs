/**
 * One-shot: copy the local PGLite dashboard_state ('main' row) into the Neon
 * database declared by DATABASE_URL. Idempotent — upserts on state_key.
 *
 *   DATABASE_URL=postgresql://... node scripts/migrate-to-neon.mjs
 */
import { PGlite } from "@electric-sql/pglite";

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pg = new PGlite({ dataDir: ".pglite-data" });
await pg.waitReady;

const rows = await pg.query("select state from dashboard_state where state_key = 'main'");
const state = rows.rows[0]?.state;
await pg.close();

if (!state) {
  console.error("No 'main' row found in local PGLite — nothing to migrate");
  process.exit(1);
}

const json = JSON.stringify(state);
console.log("local state keys:", Object.keys(state).join(", "));
console.log("period:", state.period, "| json bytes:", json.length);

const { Pool } = await import("pg");
const pool = new Pool({ connectionString: NEON_URL });

const client = await pool.connect();
try {
  await client.query("begin");
  await client.query(
    `insert into dashboard_state (state_key, state, updated_at)
     values ('main', $1::jsonb, now())
     on conflict (state_key)
     do update set state = excluded.state, updated_at = now()`,
    [json],
  );
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  console.error("FAILED:", err.message);
  process.exit(1);
} finally {
  client.release();
}

const check = await pool.query(
  "select state_key, jsonb_typeof(state) as kind, updated_at from dashboard_state",
);
console.log("neon dashboard_state now:", check.rows);
await pool.end();
console.log("DONE");
