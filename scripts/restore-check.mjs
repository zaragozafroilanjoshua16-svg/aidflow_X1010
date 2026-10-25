import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(
  process.cwd(),
);
const data = process.env.AIDFLOW_DATA_DIR;
if (!data)
  throw new Error(
    "Set AIDFLOW_DATA_DIR to the private isolated cluster directory first.",
  );
const root =
  process.env.AIDFLOW_BACKUP_DIR ||
  join(process.env.LOCALAPPDATA || process.env.HOME, "AidFlow", "backups");
const file = readdirSync(root)
  .filter((n) => n.endsWith(".dump"))
  .sort()
  .at(-1);
if (!file) throw new Error("Create a private db:backup first.");
const manifest = JSON.parse(
  readFileSync(join(root, file.replace(/\.dump$/, ".json")), "utf8"),
);
const secrets = JSON.parse(readFileSync(join(data, "local-db.json"), "utf8"));
const appUrl = new URL(process.env.DATABASE_URL);
if (appUrl.hostname !== "127.0.0.1" || appUrl.port !== "55432")
  throw new Error(
    "This rehearsal only supports the isolated local cluster on port 55432.",
  );
const admin = new pg.Client({
  host: "127.0.0.1",
  port: 55432,
  database: "postgres",
  user: "aidflow_bootstrap",
  password: secrets.adminPassword,
});
const name = `aidflow_restore_check_${randomBytes(8).toString("hex")}`;
if (!/^aidflow_restore_check_[a-f0-9]{16}$/.test(name))
  throw new Error("Invalid disposable database name.");
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name} OWNER aidflow_app`);
  created = true;
  const bin =
    process.env.AIDFLOW_PG_BIN || "D:/Program Files/PostgreSQL/18/bin";
  const childEnv = {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: "55432",
    PGUSER: decodeURIComponent(appUrl.username),
    PGPASSWORD: decodeURIComponent(appUrl.password),
    PGDATABASE: name,
  };
  const restored = spawnSync(
    join(bin, "pg_restore.exe"),
    [
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      name,
      join(root, file),
    ],
    { env: childEnv, windowsHide: true, stdio: "ignore" },
  );
  if (restored.status !== 0)
    throw new Error("Private disposable restoration failed.");
  const restoredUrl = new URL(appUrl);
  restoredUrl.pathname = `/${name}`;
  const client = new pg.Client({ connectionString: restoredUrl.href });
  try {
    await client.connect();
    const actual = (
      await client.query(
        "SELECT (SELECT count(*) FROM campaigns)::text AS campaigns,(SELECT count(*) FROM donation_orders)::text AS orders,(SELECT count(*) FROM payout_evidence)::text AS evidence",
      )
    ).rows[0];
    if (JSON.stringify(actual) !== JSON.stringify(manifest.counts))
      throw new Error(
        "Restored campaign/order/evidence counts differ from the backup manifest.",
      );
    console.log(
      "Private backup restored into an isolated disposable database; campaign/order/evidence counts match. Live AidFlow database unchanged.",
    );
  } finally {
    await client.end();
  }
} finally {
  if (created) await admin.query(`DROP DATABASE ${name}`);
  await admin.end();
}
