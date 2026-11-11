// PostgreSQL connection pool plus small helpers used by the repositories:
//   query(sql, params, client?)  — runs on the given transaction client, or on the pool
//   transaction(fn)              — BEGIN / COMMIT, ROLLBACK on error; fn receives the client
import pg from "pg";
import { config } from "./index.js";

// DATE columns stay "YYYY-MM-DD" strings (no time-zone shifts); NUMERIC becomes a JS number.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number.parseFloat(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number.parseInt(v, 10)));

export const pool = new pg.Pool(config.db);

export function query(sql, params = [], client = pool) {
  return client.query(sql, params);
}

/** Rows of a query. */
export async function rows(sql, params = [], client = pool) {
  return (await client.query(sql, params)).rows;
}

/** First row of a query, or null. */
export async function one(sql, params = [], client = pool) {
  return (await client.query(sql, params)).rows[0] ?? null;
}

/** Runs fn(client) inside a transaction and returns its result. */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Serializes concurrent transactions on the same key until the transaction ends (pg_advisory_xact_lock). */
export const lockKey = (client, key) => client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);

export const closeDatabase = () => pool.end();
