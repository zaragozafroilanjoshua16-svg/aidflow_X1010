import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { testDatabase } from "./db-helper";
import {
  createOrder,
  prepareOrder,
  submitOrder,
  reconcileOrder,
  getOrder,
} from "@/lib/orders";
import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { envelopeHash } from "@/lib/transaction";
let pool: Pool,
  close: () => Promise<void>,
  campaignId: string,
  actor: { id: string; role: "USER" },
  stranger: { id: string; role: "USER" };
const payer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9));
const contract = "CCC3WAJYZZWJTGX2K223Y32E6A4XAQNV77LN4CYSUQSVB6E5K3NSTPHD";
const split = "CBFYA2UYSTDJ2ENMLMWKEXKBZK4GYP6QWVNTW3B7K4GAB6XQA5YWN3PG";
const relief = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 10)).publicKey();
const logistics = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 11)).publicKey();
const tx = new TransactionBuilder(new Account(payer.publicKey(), "1"), {
  fee: "100",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    new Contract(contract).call(
      "deposit",
      new Address(payer.publicKey()).toScVal(),
      nativeToScVal(10000000n, { type: "i128" }),
    ),
  )
  .setTimeout(180)
  .build();
const unsigned = tx.toXDR();
tx.sign(payer);
const signed = tx.toXDR();
const hash = envelopeHash(unsigned);
const calls = vi.hoisted(() => ({
  prepare: vi.fn(),
  submit: vi.fn(),
  status: vi.fn(),
  events: vi.fn(),
  proof: vi.fn(),
  config: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/paiflow", () => ({
  preparePayment: calls.prepare,
  submitPayment: calls.submit,
  paymentStatus: calls.status,
  paymentEvents: calls.events,
  configuration: calls.config,
}));
vi.mock("@/lib/chain-proof", () => ({ chainProof: calls.proof }));
vi.mock("@/lib/db", () => ({
  database: () => pool,
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  },
}));
beforeAll(async () => {
  ({ pool, close } = await testDatabase());
  actor = {
    id: (
      await pool.query(
        "INSERT INTO users(email) VALUES('payer@example.invalid') RETURNING id",
      )
    ).rows[0].id,
    role: "USER",
  };
  stranger = {
    id: (
      await pool.query(
        "INSERT INTO users(email) VALUES('stranger@example.invalid') RETURNING id",
      )
    ).rows[0].id,
    role: "USER",
  };
  campaignId = (
    await pool.query(`INSERT INTO campaigns(slug,title,description,disaster_type,country,region,beneficiary_type,is_demo,is_seeded,review_status)
    VALUES('relief','Fictional relief','Demo','flood','PH','Demo','FAMILY',true,true,'APPROVED') RETURNING id`)
  ).rows[0].id;
  const config = (
    await pool.query(
      `INSERT INTO campaign_payment_configs(campaign_id,version,deployment_uuid,trigger_contract,split_contract,relief_address,logistics_address,ready,verification_hash,activated_at)
    VALUES($1,1,'d6de37c1-be25-4e3c-a0ef-e3e6cce4193c',$2,$3,$4,$5,true,$6,now()) RETURNING id`,
      [campaignId, contract, split, relief, logistics, "b".repeat(64)],
    )
  ).rows[0].id;
  await pool.query(
    "UPDATE campaigns SET active_config_id=$2,fundraising_status='ACTIVE' WHERE id=$1",
    [campaignId, config],
  );
  calls.config.mockReturnValue({
    deploymentId: "d6de37c1-be25-4e3c-a0ef-e3e6cce4193c",
    baseUrl: "https://beta.app.paiflow.xyz",
  });
  calls.prepare.mockResolvedValue({
    xdr: unsigned,
    network: "testnet",
    networkPassphrase: Networks.TESTNET,
    txHash: hash,
    expiresAt: new Date(Date.now() + 180000).toISOString(),
    preparationRequestId: "original-request",
  });
  calls.submit.mockResolvedValue({
    status: "SUCCESS",
    network: "testnet",
    txHash: hash,
  });
  calls.status.mockResolvedValue({
    status: "SUCCESS",
    network: "testnet",
    txHash: hash,
  });
  calls.events.mockResolvedValue([]);
});
afterAll(async () => {
  await close?.();
});
let id: string;
it("creates fixed trusted orders and returns an existing unresolved order on duplicate clicks", async () => {
  await expect(
    createOrder(actor, {
      campaignId,
      walletAddress: payer.publicKey(),
      idempotencyKey: "bad",
      amountStroops: "1",
    }),
  ).rejects.toThrow();
  const values = await Promise.all(
    ["one", "two"].map((idempotencyKey) =>
      createOrder(actor, {
        campaignId,
        walletAddress: payer.publicKey(),
        idempotencyKey,
      }),
    ),
  );
  id = values[0]!.id;
  expect(values[1]!.id).toBe(id);
  expect(values[0]!.amountStroops).toBe("10000000");
  await expect(getOrder(stranger, id)).rejects.toMatchObject({ status: 404 });
  calls.config.mockReturnValueOnce({
    deploymentId: "d6de37c1-be25-4e3c-a0ef-e3e6cce4193c",
    baseUrl: "https://different.example",
  });
  await expect(prepareOrder(actor, id)).rejects.toMatchObject({ status: 409 });
});
it("claims preparation durably and never creates a second unsigned transaction", async () => {
  await expect(prepareOrder(stranger, id)).rejects.toMatchObject({
    status: 404,
  });
  const first = await prepareOrder(actor, id),
    second = await prepareOrder(actor, id);
  expect(first.prepared?.txHash).toBe(hash);
  expect(second.prepared?.txHash).toBe(hash);
  expect(calls.prepare).toHaveBeenCalledTimes(1);
  calls.proof.mockResolvedValue({
    status: "NOT_FOUND",
    txHash: hash,
    network: "testnet",
    payer: "",
    ledger: 0,
    nativeContract: "native",
    events: [],
  });
  const checked = await reconcileOrder(actor, id);
  expect(checked.status).toBe("AWAITING_SIGNATURE");
});
it("rejects changed bodies, saves the exact signed envelope before SDK submission, and keeps missing payouts pending", async () => {
  const changed = new TransactionBuilder(new Account(payer.publicKey(), "2"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      new Contract(contract).call(
        "deposit",
        new Address(payer.publicKey()).toScVal(),
        nativeToScVal(10000000n, { type: "i128" }),
      ),
    )
    .setTimeout(180)
    .build();
  changed.sign(payer);
  await expect(submitOrder(actor, id, changed.toXDR())).rejects.toThrow();
  expect(calls.submit).not.toHaveBeenCalled();
  const wrongNetwork = TransactionBuilder.fromXDR(unsigned, Networks.PUBLIC);
  wrongNetwork.sign(payer);
  await expect(submitOrder(actor, id, wrongNetwork.toXDR())).rejects.toThrow();
  expect(calls.submit).not.toHaveBeenCalled();
  calls.submit.mockImplementation(async () => {
    const p = (
      await pool.query(
        "SELECT signed_xdr,submit_started_at FROM blockchain_payments WHERE order_id=$1",
        [id],
      )
    ).rows[0];
    expect(p.signed_xdr).toBe(signed);
    expect(p.submit_started_at).toBeTruthy();
    return { status: "SUCCESS", txHash: hash };
  });
  calls.proof.mockResolvedValue({
    status: "NOT_FOUND",
    txHash: hash,
    network: "testnet",
    payer: "",
    ledger: 0,
    nativeContract: "native",
    events: [],
  });
  const view = await submitOrder(actor, id, signed);
  expect(view.status).not.toBe("SUCCESS");
  await submitOrder(actor, id, signed);
  expect(calls.submit).toHaveBeenCalledTimes(1);
  await expect(submitOrder(actor, id, undefined, true)).rejects.toMatchObject({
    status: 409,
  });
  // Simulate a crashed/uncertain original attempt whose claim is old enough for
  // an explicit retry. The durable original envelope is the only allowed input.
  await pool.query(
    "UPDATE blockchain_payments SET submit_started_at=now()-interval '2 minutes' WHERE order_id=$1",
    [id],
  );
  const retries = await Promise.allSettled([
    submitOrder(actor, id, undefined, true),
    submitOrder(actor, id, undefined, true),
  ]);
  expect(retries.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(retries.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(calls.submit).toHaveBeenCalledTimes(2);
  expect(calls.submit.mock.calls[1]?.[0]).toBe(signed);
});
it("preserves an uncertain preparation claim and never prepares a replacement", async () => {
  const original = await createOrder(stranger, {
    campaignId,
    walletAddress: payer.publicKey(),
    idempotencyKey: "lost-prepare",
  });
  calls.prepare.mockRejectedValueOnce(new Error("Response lost"));
  await expect(prepareOrder(stranger, original.id)).rejects.toMatchObject({
    status: 409,
  });
  const count = calls.prepare.mock.calls.length;
  await expect(prepareOrder(stranger, original.id)).rejects.toMatchObject({
    status: 409,
  });
  expect(calls.prepare).toHaveBeenCalledTimes(count);
  expect((await getOrder(stranger, original.id)).status).toBe(
    "NEEDS_OPERATOR_REVIEW",
  );
  expect(
    (
      await pool.query(
        "SELECT prepare_started_at FROM blockchain_payments WHERE order_id=$1",
        [original.id],
      )
    ).rows[0].prepare_started_at,
  ).toBeTruthy();
});
it("continues reconciling the original order while paused and only then counts exact payouts", async () => {
  await pool.query(
    "UPDATE campaigns SET fundraising_status='PAUSED' WHERE id=$1",
    [campaignId],
  );
  const transfer = (from: string, to: string, amount: string, i: string) => ({
    id: i,
    contract: "native",
    topics: ["transfer", from, to, "native"],
    amount,
  });
  calls.proof.mockResolvedValue({
    status: "SUCCESS",
    txHash: hash,
    network: "testnet",
    payer: payer.publicKey(),
    ledger: 123,
    nativeContract: "native",
    events: [
      transfer(payer.publicKey(), contract, "10000000", "1"),
      transfer(contract, split, "10000000", "2"),
      transfer(split, relief, "9000000", "3"),
      transfer(split, logistics, "1000000", "4"),
    ],
  });
  const view = await reconcileOrder(actor, id);
  expect(view.status).toBe("SUCCESS");
  expect(
    (
      await pool.query(
        "SELECT count(*) FROM payout_evidence WHERE order_id=$1",
        [id],
      )
    ).rows[0].count,
  ).toBe("2");
  await expect(
    createOrder(actor, {
      campaignId,
      walletAddress: payer.publicKey(),
      idempotencyKey: "after-pause",
    }),
  ).rejects.toThrow();
});
