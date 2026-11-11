// Database migrations and seeds with node-pg-migrate, using the connection settings of config/.
//
//   node scripts/migrate.js up              apply pending migrations          (npm run migrate)
//   node scripts/migrate.js down [n|all]    roll back n migrations (default 1) (npm run migrate:down)
//   node scripts/migrate.js fresh [--seed]  drop every table, re-run all migrations (and seeds)
//   node scripts/migrate.js seed            run every seed file               (npm run seed)
//
// Seeds work like seeders: every run applies all of them again (their history is reset first),
// so each seed file must be idempotent (e.g. INSERT ... ON CONFLICT DO NOTHING).
// New files: `npm run migrate:create -- <name>` / `npm run seed:create -- <name>`.
// The database itself (DB_NAME) is created first when it does not exist.
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runner } from "node-pg-migrate";
import { config } from "../config/index.js";

const MIGRATIONS = { dir: fileURLToPath(new URL("../migrations", import.meta.url)), migrationsTable: "pgmigrations" };
const SEEDS = { dir: fileURLToPath(new URL("../seeds", import.meta.url)), migrationsTable: "pgmigrations_seeds" };

const log = (msg) => console.log(msg);

async function ensureDatabase() {
  const client = new pg.Client({ ...config.db, database: "postgres" });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [config.db.database]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${config.db.database.replaceAll('"', '""')}"`);
      log(`Created database ${config.db.database}`);
    }
  } finally {
    await client.end();
  }
}

function run(set, direction, count) {
  return runner({
    databaseUrl: config.db,
    dir: set.dir,
    migrationsTable: set.migrationsTable,
    direction,
    count,
    checkOrder: true,
    singleTransaction: true,
    log,
  });
}

/** Seeds run every time: forget which ones ran before, then apply all of them. */
async function runSeeds() {
  const client = new pg.Client(config.db);
  await client.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS "${SEEDS.migrationsTable}"`);
  } finally {
    await client.end();
  }
  await run(SEEDS, "up", Infinity);
}

/** Drops every table (data, migration and seed history) in the public schema. */
async function dropAllTables() {
  const client = new pg.Client(config.db);
  await client.connect();
  try {
    const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (rows.length > 0) {
      await client.query(`DROP TABLE ${rows.map((r) => `"${r.tablename}"`).join(", ")} CASCADE`);
    }
    log(`Dropped ${rows.length} table(s)`);
  } finally {
    await client.end();
  }
}

const [command = "up", arg] = process.argv.slice(2);
try {
  await ensureDatabase();
  switch (command) {
    case "up":
      await run(MIGRATIONS, "up", Infinity);
      break;
    case "down":
      await run(MIGRATIONS, "down", arg === "all" ? Infinity : Number(arg ?? 1));
      break;
    case "fresh":
      await dropAllTables();
      await run(MIGRATIONS, "up", Infinity);
      if (process.argv.includes("--seed")) await runSeeds();
      break;
    case "seed":
      await runSeeds();
      break;
    default:
      throw new Error(`unknown command "${command}" (use up, down, fresh or seed)`);
  }
  log("Done.");
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exitCode = 1;
}
