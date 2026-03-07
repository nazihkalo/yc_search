import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { SCHEMA_SQL } from "../db/schema";
import { getEnv } from "./env";

type QueryValue = string | number | boolean | null | Date;
type QueryParams = Record<string, QueryValue>;
type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

let dbInstance: Pool | null = null;
let initialized = false;
let pgvectorReady: boolean | null = null;

function compileNamedQuery(text: string, params: QueryParams) {
  const values: QueryValue[] = [];
  const compiled = text.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, key: string) => {
    if (!(key in params)) {
      throw new Error(`Missing SQL parameter: ${key}`);
    }
    values.push(params[key] ?? null);
    return `$${values.length}`;
  });

  return {
    text: compiled,
    values,
  };
}

function getRunner(client?: Queryable) {
  return client ?? getDb();
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: QueryParams = {},
  client?: Queryable,
) {
  const runner = getRunner(client);
  const compiled = compileNamedQuery(text, params);
  const result = await runner.query(compiled.text, compiled.values);
  return result.rows as T[];
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: QueryParams = {},
  client?: Queryable,
) {
  const rows = await query<T>(text, params, client);
  return rows[0] ?? null;
}

export async function execute(text: string, params: QueryParams = {}, client?: Queryable) {
  const runner = getRunner(client);
  const compiled = compileNamedQuery(text, params);
  const result = await runner.query(compiled.text, compiled.values);
  return result.rowCount ?? 0;
}

export function getDb(): Pool {
  if (dbInstance) {
    return dbInstance;
  }

  const env = getEnv();
  dbInstance = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

  return dbInstance;
}

export async function initializeDatabase() {
  if (initialized) {
    return;
  }

  const db = getDb();
  await db.query(SCHEMA_SQL);
  initialized = true;
}

export async function isPgVectorReady() {
  if (pgvectorReady !== null) {
    return pgvectorReady;
  }

  const db = getDb();
  const result = await db.query<{ installed: boolean; embeddings_udt: string | null; queries_udt: string | null }>(`
    SELECT
      EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed,
      (
        SELECT udt_name
        FROM information_schema.columns
        WHERE table_name = 'company_embeddings' AND column_name = 'vector'
        LIMIT 1
      ) AS embeddings_udt,
      (
        SELECT udt_name
        FROM information_schema.columns
        WHERE table_name = 'query_embeddings' AND column_name = 'vector'
        LIMIT 1
      ) AS queries_udt
  `);

  const row = result.rows[0];
  pgvectorReady = Boolean(row?.installed) && row?.embeddings_udt === "vector" && row?.queries_udt === "vector";
  return pgvectorReady;
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withConnection<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getDb().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function tryAdvisoryLock(lockKey: string, client: PoolClient) {
  const row = await queryOne<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock(hashtext(@lockKey)) AS locked",
    { lockKey },
    client,
  );
  return Boolean(row?.locked);
}

export async function advisoryUnlock(lockKey: string, client: PoolClient) {
  await execute("SELECT pg_advisory_unlock(hashtext(@lockKey))", { lockKey }, client);
}

export async function closeDb() {
  if (!dbInstance) {
    return;
  }

  await dbInstance.end();
  dbInstance = null;
  initialized = false;
  pgvectorReady = null;
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
