import "server-only";
import { database, withTransaction } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/identity-policy";
import type { OrderView, OrderRow, PaymentRow } from "@/lib/order-types";
import type { PoolClient } from "pg";
import { object, text, uuid } from "@/lib/validation";
import { RequestError } from "@/lib/http";
import {
  StrKey,
  Keypair,
  TransactionBuilder,
  FeeBumpTransaction,
  Address,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  preparePayment,
  submitPayment,
  paymentStatus,
  paymentEvents,
  configuration,
} from "@/lib/paiflow";
import { assertOriginal } from "@/lib/transaction";
import { chainProof } from "@/lib/chain-proof";
import { verifyReceipt, type PaymentSnapshot } from "@/lib/receipt";
import { TESTNET, type Prepared } from "@/lib/types";

const final = (s: string) => s === "SUCCESS" || s === "CONFIRMED_FAILED";
async function owned(c: PoolClient, actor: Actor, id: string) {
  const row = (
    await c.query<OrderRow>(
      "SELECT * FROM donation_orders WHERE id=$1 AND donor_user_id=$2 FOR UPDATE",
      [uuid(id), actor.id],
    )
  ).rows[0];
  if (!row) throw new RequestError(404, "NOT_FOUND", "Donation not found.");
  return row;
}
function configured(order: OrderRow) {
  const config = configuration();
  if (
    config.deploymentId !== order.snapshot.deploymentId ||
    config.baseUrl !== order.snapshot.baseUrl
  )
    throw new RequestError(
      409,
      "CONFIGURATION_CHANGED",
      "Restore the original deployment configuration to reconcile this order.",
    );
}
async function audit(c: PoolClient, actor: Actor, id: string, action: string) {
  await c.query(
    "INSERT INTO audit_logs(actor_user_id,action,entity_id) VALUES($1,$2,$3)",
    [actor.id, action, id],
  );
}
export async function createOrder(
  actor: Actor,
  body: unknown,
): Promise<OrderView> {
  requireActor(actor);
  const b = object(body, ["campaignId", "walletAddress", "idempotencyKey"]);
  const campaignId = uuid(b.campaignId),
    wallet = text(b.walletAddress, 56, 56),
    key = text(b.idempotencyKey, 1, 100);
  if (!StrKey.isValidEd25519PublicKey(wallet))
    throw new RequestError(
      400,
      "VALIDATION",
      "Connect a valid Stellar public account.",
    );
  const id = await withTransaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `${actor.id}:${campaignId}:${wallet}`,
    ]);
    const replay = (
      await c.query<OrderRow>(
        "SELECT * FROM donation_orders WHERE donor_user_id=$1 AND idempotency_key=$2",
        [actor.id, key],
      )
    ).rows[0];
    if (replay) {
      if (replay.campaign_id !== campaignId || replay.wallet_address !== wallet)
        throw new RequestError(
          409,
          "CONFLICT",
          "Idempotency key belongs to a different original order.",
        );
      return replay.id;
    }
    const config = (
      await c.query(
        `SELECT p.*,c.fundraising_status,c.review_status,c.is_seeded FROM campaigns c JOIN campaign_payment_configs p ON p.id=c.active_config_id WHERE c.id=$1 FOR SHARE OF c`,
        [campaignId],
      )
    ).rows[0];
    if (
      !config ||
      !config.is_seeded ||
      config.review_status !== "APPROVED" ||
      config.fundraising_status !== "ACTIVE" ||
      !config.ready ||
      config.deployment_uuid !== configuration().deploymentId
    )
      throw new RequestError(
        409,
        "NOT_READY",
        "This campaign is not ready for new Testnet payments.",
      );
    const prior = (
      await c.query(
        "SELECT id FROM donation_orders WHERE donor_user_id=$1 AND campaign_id=$2 AND wallet_address=$3 AND status NOT IN ('SUCCESS','CONFIRMED_FAILED')",
        [actor.id, campaignId, wallet],
      )
    ).rows[0];
    if (prior) return prior.id;
    const snapshot: PaymentSnapshot = {
      deploymentId: config.deployment_uuid,
      baseUrl: configuration().baseUrl,
      version: config.version,
      triggerContract: config.trigger_contract,
      splitContract: config.split_contract,
      reliefAddress: config.relief_address,
      logisticsAddress: config.logistics_address,
    };
    const row = (
      await c.query(
        `INSERT INTO donation_orders(donor_user_id,campaign_id,payment_config_id,wallet_address,idempotency_key,snapshot)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          actor.id,
          campaignId,
          config.id,
          wallet,
          key,
          JSON.stringify(snapshot),
        ],
      )
    ).rows[0];
    await audit(c, actor, row.id, "ORDER_CREATED");
    return row.id;
  });
  return getOrder(actor, id);
}
function validatePrepared(order: OrderRow, p: Prepared) {
  if (p.network !== "testnet" || p.networkPassphrase !== TESTNET)
    throw new Error("Unexpected preparation network.");
  const tx = TransactionBuilder.fromXDR(p.xdr, TESTNET);
  if (
    tx instanceof FeeBumpTransaction ||
    tx.source !== order.wallet_address ||
    tx.operations.length !== 1
  )
    throw new Error("Unexpected payer or operations.");
  const op = tx.operations[0]!;
  if (
    op.type !== "invokeHostFunction" ||
    op.func.type !== "hostFunctionTypeInvokeContract" ||
    (op.source && op.source !== order.wallet_address)
  )
    throw new Error("Unexpected execution.");
  const call = op.func.invokeContract;
  if (
    Address.fromScAddress(call.contractAddress).toString() !==
      order.snapshot.triggerContract ||
    String(call.functionName) !== "deposit" ||
    call.args.length !== 2 ||
    scValToNative(call.args[0]!) !== order.wallet_address ||
    String(scValToNative(call.args[1]!)) !== "10000000"
  )
    throw new Error("Unexpected original deposit body.");
  assertOriginal(p.xdr, p.xdr, p.txHash);
}
export async function prepareOrder(
  actor: Actor,
  id: string,
): Promise<OrderView> {
  requireActor(actor);
  const claim = await withTransaction(async (c) => {
    const order = await owned(c, actor, id);
    configured(order);
    if (
      [
        "PREPARED",
        "AWAITING_SIGNATURE",
        "SUBMITTED",
        "PENDING_VERIFICATION",
        "SUCCESS",
        "CONFIRMED_FAILED",
      ].includes(order.status)
    )
      return null;
    if (order.status !== "CREATED")
      throw new RequestError(
        409,
        "UNRESOLVED",
        "Original preparation may still be in flight. Check this order; do not replace it.",
      );
    const campaign = (
      await c.query(
        "SELECT fundraising_status,review_status FROM campaigns WHERE id=$1 FOR SHARE",
        [order.campaign_id],
      )
    ).rows[0];
    if (
      campaign?.fundraising_status !== "ACTIVE" ||
      campaign.review_status !== "APPROVED"
    )
      throw new RequestError(
        409,
        "NOT_READY",
        "Campaign is paused for new preparations.",
      );
    await c.query(
      "INSERT INTO blockchain_payments(order_id,prepare_started_at) VALUES($1,now())",
      [id],
    );
    await c.query(
      "UPDATE donation_orders SET status='PREPARING',updated_at=now() WHERE id=$1",
      [id],
    );
    await audit(c, actor, id, "PREPARATION_CLAIMED");
    return order;
  });
  if (!claim) return getOrder(actor, id);
  try {
    const p = await preparePayment(claim.wallet_address);
    // Save even an unexpected response before validating its deposit body.
    await database().query(
      `UPDATE blockchain_payments SET preparation=$2,unsigned_xdr=$3,network_passphrase=$4,tx_hash=$5,preparation_request_id=$6 WHERE order_id=$1`,
      [
        id,
        JSON.stringify(p),
        p.xdr,
        p.networkPassphrase,
        p.txHash,
        p.preparationRequestId || null,
      ],
    );
    validatePrepared(claim, p);
    await database().query(
      "UPDATE donation_orders SET status='AWAITING_SIGNATURE',updated_at=now() WHERE id=$1",
      [id],
    );
  } catch {
    await database().query(
      "UPDATE donation_orders SET status='NEEDS_OPERATOR_REVIEW',updated_at=now() WHERE id=$1",
      [id],
    );
    throw new RequestError(
      409,
      "UNRESOLVED",
      "Original preparation requires review. Its evidence is retained; no replacement was created.",
    );
  }
  return getOrder(actor, id);
}
export async function submitOrder(
  actor: Actor,
  id: string,
  signedXdr?: string,
  retry = false,
): Promise<OrderView> {
  requireActor(actor);
  const claim = await withTransaction(async (c) => {
    const order = await owned(c, actor, id);
    configured(order);
    const payment = (
      await c.query<PaymentRow>(
        "SELECT * FROM blockchain_payments WHERE order_id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!payment?.preparation || !payment.unsigned_xdr || !payment.tx_hash)
      throw new RequestError(
        409,
        "NOT_PREPARED",
        "Recover the saved original preparation first.",
      );
    const envelope = signedXdr || payment.signed_xdr;
    if (!envelope || envelope.length > 200000)
      throw new RequestError(
        400,
        "VALIDATION",
        "Original signed envelope required.",
      );
    try {
      validatePrepared(order, payment.preparation);
      assertOriginal(payment.unsigned_xdr, envelope, payment.tx_hash);
      const tx = TransactionBuilder.fromXDR(envelope, TESTNET);
      if (tx instanceof FeeBumpTransaction || tx.signatures.length === 0)
        throw new Error("Signature missing.");
      const payer = Keypair.fromPublicKey(order.wallet_address);
      if (
        !tx.signatures.some((signature) =>
          payer.verify(tx.hash(), signature.signature),
        )
      )
        throw new Error(
          "Original donor must sign for the stored Testnet passphrase.",
        );
    } catch {
      throw new RequestError(
        400,
        "TAMPERED",
        "Signed transaction must preserve the original payer, network and body.",
      );
    }
    if (payment.signed_xdr && payment.signed_xdr !== envelope)
      throw new RequestError(
        409,
        "CONFLICT",
        "A different signed envelope is already saved for this order.",
      );
    if (final(order.status)) return null;
    if (payment.submit_started_at) {
      if (!retry) return null;
      if (
        !payment.signed_xdr ||
        Date.now() - payment.submit_started_at.getTime() < 60000
      )
        throw new RequestError(
          409,
          "SUBMISSION_IN_FLIGHT",
          "Wait at least one minute, check the original payment, then explicitly retry the exact stored envelope if needed.",
        );
    } else if (retry || order.status !== "AWAITING_SIGNATURE")
      throw new RequestError(
        409,
        "UNRESOLVED",
        "This original order needs reconciliation or operator review.",
      );
    await c.query(
      "UPDATE blockchain_payments SET signed_xdr=$2,submit_started_at=now() WHERE order_id=$1",
      [id, envelope],
    );
    await c.query(
      "UPDATE donation_orders SET status='SUBMITTED',updated_at=now() WHERE id=$1",
      [id],
    );
    await audit(
      c,
      actor,
      id,
      retry ? "EXACT_ORIGINAL_RETRY_CLAIMED" : "SIGNED_ORIGINAL_SAVED",
    );
    return { envelope, requestId: payment.preparation_request_id };
  });
  if (claim) {
    try {
      const result = await submitPayment(
        claim.envelope,
        claim.requestId || undefined,
      );
      await database().query(
        "UPDATE blockchain_payments SET submission_status=$2 WHERE order_id=$1",
        [id, result.status],
      );
    } catch {
      /* Uncertain submission: only reconcile its original hash below. */
    }
    await database().query(
      "UPDATE donation_orders SET status='PENDING_VERIFICATION',updated_at=now() WHERE id=$1 AND status='SUBMITTED'",
      [id],
    );
  }
  return reconcileOrder(actor, id);
}
export async function reconcileOrder(
  actor: Actor,
  id: string,
): Promise<OrderView> {
  requireActor(actor);
  const original = await withTransaction(async (c) => {
    const order = await owned(c, actor, id);
    configured(order);
    const payment = (
      await c.query<PaymentRow>(
        "SELECT * FROM blockchain_payments WHERE order_id=$1",
        [id],
      )
    ).rows[0];
    return { order, payment };
  });
  if (final(original.order.status) || !original.payment?.tx_hash)
    return getOrder(actor, id);
  const hash = original.payment.tx_hash;
  let decision: {
    status: string;
    evidence: import("@/lib/receipt").TransferEvent[];
  } = { status: "PENDING_VERIFICATION", evidence: [] };
  let ledger = 0;
  try {
    const result = await paymentStatus(hash);
    // Always query SDK events. Exact RPC token transfers provide independent
    // evidence when the platform feed is delayed or only reports percentages.
    try {
      await paymentEvents(hash);
    } catch {
      /* Actual ledger transfers remain required. */
    }
    const proof = await chainProof(hash);
    ledger = proof.ledger;
    if (result.txHash !== hash || result.network !== "testnet")
      decision = { status: "NEEDS_OPERATOR_REVIEW", evidence: [] };
    else if (result.status === "SUCCESS" || result.status === "FAILED") {
      decision = verifyReceipt(
        original.order.snapshot,
        original.order.wallet_address,
        hash,
        proof,
      );
      if (decision.status === "SUCCESS" && result.status !== "SUCCESS")
        decision = { status: "NEEDS_OPERATOR_REVIEW", evidence: [] };
      if (decision.status === "CONFIRMED_FAILED" && result.status !== "FAILED")
        decision = { status: "NEEDS_OPERATOR_REVIEW", evidence: [] };
    }
  } catch {
    /* Timeout, NOT_FOUND and missing evidence never imply replacement. */
  }
  await withTransaction(async (c) => {
    const order = await owned(c, actor, id);
    if (final(order.status)) return;
    if (
      decision.status === "PENDING_VERIFICATION" &&
      [
        "CREATED",
        "PREPARING",
        "PREPARED",
        "AWAITING_SIGNATURE",
        "NEEDS_OPERATOR_REVIEW",
      ].includes(order.status)
    ) {
      const saved = (
        await c.query<PaymentRow>(
          "SELECT * FROM blockchain_payments WHERE order_id=$1",
          [id],
        )
      ).rows[0];
      // A read-only pre-submit lookup must not close the original submit path.
      // Preserve operator-review states too; UNKNOWN does not resolve them.
      if (!saved?.submit_started_at) return;
    }
    if (decision.status === "SUCCESS") {
      for (const e of decision.evidence)
        await c.query(
          `INSERT INTO payout_evidence(order_id,tx_hash,recipient,amount_stroops,asset,evidence_id,ledger)
        VALUES($1,$2,$3,$4,'XLM',$5,$6) ON CONFLICT DO NOTHING`,
          [id, hash, e.topics[2], e.amount, e.id, ledger],
        );
      await c.query(
        "UPDATE blockchain_payments SET verified_at=now(),ledger=$2 WHERE order_id=$1",
        [id, ledger],
      );
      await audit(c, actor, id, "EXACT_PAYOUTS_VERIFIED");
    }
    await c.query(
      "UPDATE donation_orders SET status=$2,updated_at=now() WHERE id=$1",
      [id, decision.status],
    );
  });
  return getOrder(actor, id);
}
export async function getOrder(actor: Actor, id: string): Promise<OrderView> {
  requireActor(actor);
  uuid(id);
  const order = (
    await database().query<OrderRow>(
      `SELECT o.*,c.title,c.slug FROM donation_orders o JOIN campaigns c ON c.id=o.campaign_id WHERE o.id=$1 AND o.donor_user_id=$2`,
      [id, actor.id],
    )
  ).rows[0];
  if (!order) throw new RequestError(404, "NOT_FOUND", "Donation not found.");
  const p = (
    await database().query<PaymentRow>(
      "SELECT * FROM blockchain_payments WHERE order_id=$1",
      [id],
    )
  ).rows[0];
  return {
    id: order.id,
    campaignId: order.campaign_id,
    title: order.title!,
    slug: order.slug!,
    status: order.status,
    amountStroops: order.amount_stroops,
    walletAddress: order.wallet_address,
    reliefAddress: order.snapshot.reliefAddress,
    logisticsAddress: order.snapshot.logisticsAddress,
    txHash: p?.tx_hash || null,
    hasSignedEnvelope: Boolean(p?.signed_xdr),
    submitted: Boolean(p?.submit_started_at),
    prepared: [
      "AWAITING_SIGNATURE",
      "SUBMITTED",
      "PENDING_VERIFICATION",
      "SUCCESS",
      "CONFIRMED_FAILED",
    ].includes(order.status)
      ? p?.preparation || null
      : null,
    verifiedAt: p?.verified_at?.toISOString() || null,
    createdAt: order.created_at.toISOString(),
  };
}
export async function listOrders(actor: Actor) {
  requireActor(actor);
  const rows = (
    await database().query(
      "SELECT id FROM donation_orders WHERE donor_user_id=$1 ORDER BY created_at DESC LIMIT 50",
      [actor.id],
    )
  ).rows;
  return Promise.all(rows.map((row) => getOrder(actor, row.id)));
}
