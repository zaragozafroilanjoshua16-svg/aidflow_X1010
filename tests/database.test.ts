import { afterAll, beforeAll, expect, it } from "vitest";
import { Pool } from "pg";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
// Test connection is explicit; read .env.local without exposing its values.
const parsed = nextRequire("@next/env").processEnv(
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
const url = process.env.TEST_DATABASE_URL || parsed.DATABASE_URL;
const schema = `test_${randomUUID().replaceAll("-", "")}`;
const pool = new Pool({
  connectionString: url,
  max: 1,
  options: `-c search_path=${schema},public`,
});
beforeAll(async () => {
  if (!url)
    throw new Error(
      "Configure TEST_DATABASE_URL or local DATABASE_URL to run real PostgreSQL constraint tests.",
    );
  await pool.query(`CREATE SCHEMA ${schema}`);
  if (existsSync("migrations/001_aidflow.sql"))
    await pool.query(readFileSync("migrations/001_aidflow.sql", "utf8"));
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await pool.end();
});

it("creates UUID users as USER with the adapter's quoted schema", async () => {
  const { rows } = await pool.query(
    `INSERT INTO users (name,email) VALUES ('Demo','demo@example.invalid') RETURNING id,role`,
  );
  expect(rows[0].id).toMatch(/^[a-f0-9-]{36}$/);
  expect(rows[0].role).toBe("USER");
});

it("rejects campaigns that activate without reviewed payment configuration", async () => {
  await expect(
    pool.query(`INSERT INTO campaigns (slug,title,description,disaster_type,country,region,beneficiary_type,fundraising_status)
    VALUES ('bad','Bad','Fictional','flood','PH','Demo','FAMILY','ACTIVE')`),
  ).rejects.toMatchObject({ code: "23514" });
});

it("enforces immutable fixed-price orders and unique original transaction hashes", async () => {
  const user = (
    await pool.query(
      `INSERT INTO users(email) VALUES('order@example.invalid') RETURNING id`,
    )
  ).rows[0].id;
  const campaign = (
    await pool.query(`INSERT INTO campaigns(slug,title,description,disaster_type,country,region,beneficiary_type,is_demo,is_seeded)
    VALUES('valid','Fictional relief','Demo','flood','PH','Demo','FAMILY',true,true) RETURNING id`)
  ).rows[0].id;
  const config = (
    await pool.query(
      `INSERT INTO campaign_payment_configs(campaign_id,version,deployment_uuid,trigger_contract,split_contract,relief_address,logistics_address)
    VALUES($1,1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        campaign,
        randomUUID(),
        "C".repeat(56),
        "C" + "A".repeat(55),
        "G" + "A".repeat(55),
        "G" + "B".repeat(55),
      ],
    )
  ).rows[0].id;
  const insert = (amount: string, key: string, wallet = "G" + "A".repeat(55)) =>
    pool.query(
      `INSERT INTO donation_orders(donor_user_id,campaign_id,payment_config_id,wallet_address,idempotency_key,amount_stroops,snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        user,
        campaign,
        config,
        wallet,
        key,
        amount,
        JSON.stringify({ deploymentId: randomUUID() }),
      ],
    );
  await expect(insert("1", "wrong")).rejects.toMatchObject({ code: "23514" });
  const first = (await insert("10000000", "one")).rows[0].id;
  await expect(insert("10000000", "duplicate-active")).rejects.toMatchObject({
    code: "23505",
  });
  const second = (await insert("10000000", "two", "G" + "B".repeat(55))).rows[0]
    .id;
  await expect(insert("10000000", "one")).rejects.toMatchObject({
    code: "23505",
  });
  await pool.query(
    `INSERT INTO blockchain_payments(order_id,tx_hash) VALUES($1,$2)`,
    [first, "a".repeat(64)],
  );
  await expect(
    pool.query(
      `INSERT INTO blockchain_payments(order_id,tx_hash) VALUES($1,$2)`,
      [second, "a".repeat(64)],
    ),
  ).rejects.toMatchObject({ code: "23505" });
  await expect(
    pool.query(`UPDATE donation_orders SET wallet_address=$2 WHERE id=$1`, [
      first,
      "G" + "B".repeat(55),
    ]),
  ).rejects.toThrow();
});
