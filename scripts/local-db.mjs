import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";

const envPath = join(process.cwd(), ".env.local");
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
if (/^DATABASE_URL=\S+/m.test(env)) {
  console.log(
    "DATABASE_URL already configured; keeping the existing database.",
  );
  process.exit(0);
}
const root =
  process.env.AIDFLOW_DATA_DIR ||
  join(process.env.LOCALAPPDATA || process.env.HOME, "AidFlow");
const data = join(root, "postgres");
const bin = process.env.AIDFLOW_PG_BIN || "D:/Program Files/PostgreSQL/18/bin";
const port = 55432;
mkdirSync(root, { recursive: true });
const secretsPath = join(root, "local-db.json");
const saved = existsSync(secretsPath)
  ? JSON.parse(readFileSync(secretsPath, "utf8"))
  : {
      adminPassword: randomBytes(32).toString("hex"),
      appPassword: randomBytes(32).toString("hex"),
    };
writeFileSync(secretsPath, JSON.stringify(saved), { mode: 0o600 });
function run(name, args) {
  const r = spawnSync(join(bin, `${name}.exe`), args, {
    windowsHide: true,
    encoding: "utf8",
    ...(name === "pg_ctl" ? { stdio: "ignore" } : {}),
  });
  writeFileSync(
    join(root, `${name}.log`),
    `${r.stdout || ""}\n${r.stderr || ""}\n${r.error?.code || ""}`,
  );
  if (r.status !== 0)
    throw new Error(
      `${name} failed. Inspect the private PostgreSQL log in ${root}.`,
    );
}
if (!existsSync(join(data, "PG_VERSION"))) {
  const passwordPath = join(root, "init-password.tmp");
  writeFileSync(passwordPath, saved.adminPassword, { mode: 0o600 });
  try {
    run("initdb", [
      "-D",
      data,
      "-U",
      "aidflow_bootstrap",
      "--pwfile",
      passwordPath,
      "--auth-local=scram-sha-256",
      "--auth-host=scram-sha-256",
      "--encoding=UTF8",
      "--locale=C",
    ]);
  } finally {
    unlinkSync(passwordPath);
  }
}
const status = spawnSync(join(bin, "pg_ctl.exe"), ["-D", data, "status"], {
  windowsHide: true,
});
if (status.status !== 0)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port}`,
    "-w",
    "start",
  ]);
const admin = new pg.Client({
  host: "127.0.0.1",
  port,
  database: "postgres",
  user: "aidflow_bootstrap",
  password: saved.adminPassword,
});
try {
  await admin.connect();
  if (
    !(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='aidflow_app'"))
      .rowCount
  )
    await admin.query(
      `CREATE ROLE aidflow_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${saved.appPassword}'`,
    );
  if (
    !(await admin.query("SELECT 1 FROM pg_database WHERE datname='aidflow'"))
      .rowCount
  )
    await admin.query("CREATE DATABASE aidflow OWNER aidflow_app");
} finally {
  await admin.end();
}
env += `\nDATABASE_URL=postgresql://aidflow_app:${saved.appPassword}@127.0.0.1:${port}/aidflow\n`;
if (!/^AUTH_SECRET=\S+/m.test(env))
  env += `AUTH_SECRET=${randomBytes(32).toString("hex")}\n`;
writeFileSync(envPath, env, { mode: 0o600 });
console.log(
  `Local AidFlow PostgreSQL ready on 127.0.0.1:${port}; app uses a non-superuser role. Credentials saved locally, never printed.`,
);
