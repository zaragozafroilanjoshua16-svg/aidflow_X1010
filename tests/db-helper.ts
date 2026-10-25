import { Pool } from "pg";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const loader = createRequire(require.resolve("next/package.json"))("@next/env");
export async function testDatabase() {
  const parsed = loader.processEnv(
    [
      {
        path: ".env.local",
        contents: existsSync(".env.local")
          ? readFileSync(".env.local", "utf8")
          : "",
        env: {},
      },
    ],
    undefined,
    true,
  )[1];
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL || parsed.DATABASE_URL,
    max: 8,
    options: `-c search_path=${schema},public`,
  });
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(readFileSync("migrations/001_aidflow.sql", "utf8"));
  return {
    pool,
    async close() {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    },
  };
}
