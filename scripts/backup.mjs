import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(
  process.cwd(),
);
const root = resolve(
  process.env.AIDFLOW_BACKUP_DIR ||
    join(process.env.LOCALAPPDATA || process.env.HOME, "AidFlow", "backups"),
);
const workspace = resolve(process.cwd());
if (
  root === workspace ||
  root.startsWith(workspace + "\\") ||
  root.startsWith(workspace + "/")
)
  throw new Error("Backups must be outside the repository.");
mkdirSync(root, { recursive: true });
const bin = process.env.AIDFLOW_PG_BIN || "D:/Program Files/PostgreSQL/18/bin";
const url = new URL(process.env.DATABASE_URL);
const name = `aidflow-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const dump = join(root, `${name}.dump`);
const childEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || "5432",
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
};
const r = spawnSync(
  join(bin, "pg_dump.exe"),
  ["--format=custom", "--file", dump],
  { env: childEnv, windowsHide: true, stdio: "ignore" },
);
if (r.status !== 0)
  throw new Error("Private backup failed; verify local database access.");
const check = spawnSync(join(bin, "pg_restore.exe"), ["--list", dump], {
  windowsHide: true,
  stdio: "ignore",
});
if (check.status !== 0) throw new Error("Backup archive listing check failed.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const counts = (
    await client.query(
      "SELECT (SELECT count(*) FROM campaigns)::text AS campaigns,(SELECT count(*) FROM donation_orders)::text AS orders,(SELECT count(*) FROM payout_evidence)::text AS evidence",
    )
  ).rows[0];
  writeFileSync(
    join(root, `${name}.json`),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        counts,
        archiveListingVerified: true,
        restorationTested: false,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
console.log(
  `Private backup created in ${root}. Archive listing checked; restoration not yet tested.`,
);
