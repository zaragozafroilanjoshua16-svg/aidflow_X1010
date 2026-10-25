import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import pg from "pg";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(
  process.cwd(),
);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required in .env.local.");
  await client.connect();
  await client.query("SELECT pg_advisory_lock(8246025)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`migrations/${name}`, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const prior = (
      await client.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      )
    ).rows[0];
    if (prior) {
      if (prior.checksum !== checksum)
        throw new Error(
          "An applied migration changed; create a new migration.",
        );
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    console.log(`Applied ${name}`);
  }
  console.log("Migrations up to date.");
} catch (error) {
  console.error(
    `Migration failed (${error.code || "configuration"}). Check database setup; no credentials were logged.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
