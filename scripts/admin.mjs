import { createRequire } from "node:module";
import pg from "pg";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(
  process.cwd(),
);
const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: pnpm admin:grant verified-google-email");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  const user = (
    await client.query(
      `SELECT u.id FROM users u JOIN accounts a ON a."userId"=u.id WHERE lower(u.email)=lower($1) AND a.provider='google' FOR UPDATE OF u`,
      [email],
    )
  ).rows[0];
  if (!user)
    throw new Error(
      "Sign in through Google first; no matching Google account exists.",
    );
  await client.query("UPDATE users SET role='ADMIN' WHERE id=$1", [user.id]);
  await client.query(
    "INSERT INTO audit_logs(actor_user_id,action,entity_id) VALUES($1,'TRUSTED_ADMIN_BOOTSTRAP',$1)",
    [user.id],
  );
  await client.query("COMMIT");
  console.log(
    "Granted ADMIN to the existing Google account through trusted local setup.",
  );
} catch {
  try {
    await client.query("ROLLBACK");
  } catch {}
  console.error(
    "Admin bootstrap failed. Check the account exists after Google sign-in.",
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
