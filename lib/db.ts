import "server-only";
import { Pool, type PoolClient } from "pg";

const globalDb = globalThis as unknown as { aidflowPool?: Pool };
export function database(): Pool {
  if (!process.env.DATABASE_URL)
    throw new Error("AidFlow database is not configured.");
  return (globalDb.aidflowPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 8,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
export async function withTransaction<T>(
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
