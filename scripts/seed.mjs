import { createRequire } from "node:module";
import pg from "pg";
import { chainProof } from "../lib/chain-proof.ts";
import { verifyReceipt } from "../lib/receipt.ts";
const require = createRequire(import.meta.url);
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(
  process.cwd(),
);
// These public bindings were independently verified in the authorized rehearsal.
// No receipt or donation order is seeded from this configuration proof.
const verified = {
  deploymentId: "d6de37c1-be25-4e3c-a0ef-e3e6cce4193c",
  baseUrl: "https://beta.app.paiflow.xyz",
  version: 1,
  triggerContract: "CCC3WAJYZZWJTGX2K223Y32E6A4XAQNV77LN4CYSUQSVB6E5K3NSTPHD",
  splitContract: "CBFYA2UYSTDJ2ENMLMWKEXKBZK4GYP6QWVNTW3B7K4GAB6XQA5YWN3PG",
  reliefAddress: "GDYR2EWJCIVFHUF2V5VWMXGZFT5B4J6U7LRZGJWV7ZNPZIQG4MUTO6BX",
  logisticsAddress: "GBGPI4CKOPJMMHEBRC43DPTNLGY4EXUKR2R56VSW4CQX4XPYY3BCZTWH",
};
const hash = "44f6592d76f28d1f1b31b42fabc984959eef193ec7e51de70ddd67bf82781d89";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  if (process.env.PAIFLOW_DEPLOYMENT_ID !== verified.deploymentId)
    throw new Error("Seed does not match configured deployment.");
  const proof = await chainProof(hash);
  if (
    verifyReceipt(verified, verified.reliefAddress, hash, proof).status !==
    "SUCCESS"
  )
    throw new Error(
      "Live configuration proof unavailable; not activating campaign.",
    );
  await client.connect();
  await client.query("BEGIN");
  const campaign = (
    await client.query(`INSERT INTO campaigns(slug,title,description,disaster_type,country,region,beneficiary_type,is_demo,is_seeded,review_status,consent_attested)
    VALUES('habagat-relief-demo','A safer start after the storm','FICTIONAL DEMO: Help 40 illustrative families in a Philippine coastal community restore safe shelter, clean water and essential supplies after a fictional typhoon. This is synthetic evidence for a Testnet prototype. No real beneficiaries, identity checks or relief deliveries are claimed.','typhoon','PH','Eastern Visayas','ORGANIZATION',true,true,'APPROVED',true)
    ON CONFLICT(slug) DO UPDATE SET slug=excluded.slug RETURNING id`)
  ).rows[0];
  const config =
    (
      await client.query(
        `INSERT INTO campaign_payment_configs(campaign_id,version,deployment_uuid,trigger_contract,split_contract,relief_address,logistics_address,ready,verification_hash,activated_at)
    VALUES($1,1,$2,$3,$4,$5,$6,true,$7,now()) ON CONFLICT(campaign_id,version) DO NOTHING RETURNING id`,
        [
          campaign.id,
          verified.deploymentId,
          verified.triggerContract,
          verified.splitContract,
          verified.reliefAddress,
          verified.logisticsAddress,
          hash,
        ],
      )
    ).rows[0] ||
    (
      await client.query(
        "SELECT id FROM campaign_payment_configs WHERE campaign_id=$1 AND version=1",
        [campaign.id],
      )
    ).rows[0];
  await client.query(
    "UPDATE campaigns SET active_config_id=$2,fundraising_status='ACTIVE' WHERE id=$1",
    [campaign.id, config.id],
  );
  await client.query(
    "INSERT INTO audit_logs(action,entity_id,metadata) VALUES('DEMO_SEED_VERIFIED',$1,$2)",
    [
      campaign.id,
      JSON.stringify({ verificationHash: hash, network: "testnet" }),
    ],
  );
  await client.query("COMMIT");
  console.log(
    "Seeded one fictional campaign with verified Testnet config. Seeded donations: 0.",
  );
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  console.error(
    `Seed failed (${error.code || "verification"}); no activation claimed.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
