"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TransactionBuilder, FeeBumpTransaction } from "@stellar/stellar-sdk";
import { connectWallet, signPrepared } from "@/lib/wallet";
import { assertOriginal } from "@/lib/transaction";
import {
  readRecovery,
  saveRecovery,
  assertNoConflictingRecovery,
  type Recovery,
} from "@/lib/recovery";
import { browserRequest } from "@/lib/browser-api";
import { TESTNET } from "@/lib/types";
import { xlm } from "@/lib/display";
import type { OrderView } from "@/lib/order-types";
import { retireFinalIntent } from "@/lib/checkout-storage";

type CampaignInfo = {
  id: string;
  title: string;
  slug: string;
  reliefAddress: string;
  logisticsAddress: string;
};
export function DonationCheckout({
  userId,
  campaign,
  initialOrder = null,
}: {
  userId: string;
  campaign: CampaignInfo;
  initialOrder?: OrderView | null;
}) {
  const [order, setOrder] = useState(initialOrder),
    [wallet, setWallet] = useState(initialOrder?.walletAddress || "");
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [signed, setSigned] = useState(false),
    [storageReady, setStorageReady] = useState(false);
  const active = useRef(false),
    current = useRef(order);
  current.current = order;
  const scope = (id: string) => `aidflow:${userId}:${id}`;
  const key = (id: string) => `aidflow-order-v1:${userId}:${id}`;
  const intentKey = `aidflow-create-v1:${userId}:${campaign.id}`;
  function local(o: OrderView): Recovery | null {
    const raw = localStorage.getItem(key(o.id));
    if (!raw) return null;
    const record = readRecovery(scope(o.id), raw);
    if (
      record.address !== o.walletAddress ||
      record.prepared.txHash !== o.txHash
    )
      throw new Error(
        "Browser evidence differs from the saved original order. Preserve it for operator review.",
      );
    return record;
  }
  function save(o: OrderView, r: Recovery) {
    saveRecovery(localStorage, key(o.id), r);
    setSigned(Boolean(r.signedXdr));
  }
  useEffect(() => {
    try {
      const probe = `aidflow-storage-check:${userId}`;
      localStorage.setItem(probe, "1");
      if (localStorage.getItem(probe) !== "1")
        throw new Error("Storage verification failed.");
      localStorage.removeItem(probe);
      // Existing unresolved starter records must be reconciled on their origin.
      assertNoConflictingRecovery(localStorage, "aidflow-checkout");
      if (initialOrder?.prepared) {
        const r = local(initialOrder);
        if (r) setSigned(Boolean(r.signedXdr));
        else
          save(initialOrder, {
            version: 2,
            scope: scope(initialOrder.id),
            address: initialOrder.walletAddress,
            prepared: initialOrder.prepared,
          });
      }
      if (!navigator.locks)
        throw new Error(
          "This checkout needs a browser with Web Locks support, such as desktop Chrome.",
        );
      setStorageReady(true);
    } catch {
      setMessage(
        "Recovery storage or browser locking is unavailable. Preserve existing browser data. You can still check your original payment or open your dashboard.",
      );
    }
  }, []);
  useEffect(() => {
    if (order) {
      try {
        retireFinalIntent(localStorage, intentKey, order.id, order.status);
      } catch {
        setStorageReady(false);
        setMessage(
          "Completed request cleanup failed. Preserve all original recovery evidence.",
        );
      }
    }
  }, [order?.id, order?.status]);
  async function run(action: () => Promise<void>) {
    if (active.current || !storageReady) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      await navigator.locks.request(
        `aidflow:${userId}:${current.current?.id || campaign.id}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock)
            throw new Error(
              "Another tab is handling this payment. Return to that tab.",
            );
          await action();
        },
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Original payment unresolved. Check the original; do not start a replacement.",
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function prepare() {
    if (!consent || !wallet)
      throw new Error(
        "Connect your wallet and confirm the payment review first.",
      );
    let o = current.current;
    if (!o) {
      const raw = localStorage.getItem(intentKey);
      const intent = raw
        ? JSON.parse(raw)
        : { key: crypto.randomUUID(), wallet };
      if (intent.wallet !== wallet)
        throw new Error(
          "An original creation request belongs to another wallet. Open your dashboard to recover it.",
        );
      const value = JSON.stringify(intent);
      localStorage.setItem(intentKey, value);
      if (localStorage.getItem(intentKey) !== value)
        throw new Error("Cannot save the original order request.");
      o = await browserRequest<OrderView>("/api/donations", {
        campaignId: campaign.id,
        walletAddress: wallet,
        idempotencyKey: intent.key,
      });
      const savedIntent = JSON.stringify({ ...intent, orderId: o.id });
      localStorage.setItem(intentKey, savedIntent);
      if (localStorage.getItem(intentKey) !== savedIntent)
        throw new Error(
          "Cannot persist original order identity. Recover it from your dashboard.",
        );
      current.current = o;
      setOrder(o);
      window.history.replaceState(null, "", `/donations/${o.id}`);
    }
    if (o.status === "CREATED")
      o = await browserRequest<OrderView>(`/api/donations/${o.id}`, {
        action: "prepare",
      });
    current.current = o;
    setOrder(o);
    if (o.prepared) {
      const prior = local(o);
      if (!prior)
        save(o, {
          version: 2,
          scope: scope(o.id),
          address: o.walletAddress,
          prepared: o.prepared,
        });
    }
    setMessage(
      "Original order saved. Review the maximum fee and sign the original transaction in Freighter.",
    );
  }
  async function sign() {
    const o = current.current;
    if (!o?.prepared || !consent)
      throw new Error("Review and authorize this original payment first.");
    const prior = local(o) || {
      version: 2 as const,
      scope: scope(o.id),
      address: o.walletAddress,
      prepared: o.prepared,
    };
    if (prior.signedXdr) {
      setSigned(true);
      return;
    }
    save(o, { ...prior, signing: true });
    const envelope = await signPrepared(o.prepared, o.walletAddress);
    assertOriginal(o.prepared.xdr, envelope, o.prepared.txHash);
    save(o, { ...prior, signing: false, signedXdr: envelope });
    setMessage(
      "Your unchanged signed transaction is saved locally. Submit this original envelope when ready.",
    );
  }
  async function submit() {
    const o = current.current;
    if (!o || !consent)
      throw new Error("Review and authorize this payment first.");
    const r = local(o);
    if (!r?.signedXdr && !o.hasSignedEnvelope)
      throw new Error("Sign the original transaction first.");
    if (r) {
      if (r.signedXdr)
        assertOriginal(r.prepared.xdr, r.signedXdr, r.prepared.txHash);
      save(o, { ...r, attempted: true });
    }
    const view = await browserRequest<OrderView>(`/api/donations/${o.id}`, {
      action: "submit",
      ...(r?.signedXdr ? { signedXdr: r.signedXdr } : {}),
    });
    setOrder(view);
    current.current = view;
    setMessage(
      view.status === "SUCCESS"
        ? "Both exact payouts are verified on Testnet."
        : "Submission retained. Check the original payment for finality and payout evidence.",
    );
  }
  async function check() {
    if (active.current || !order) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const view = await browserRequest<OrderView>(
        `/api/donations/${order.id}`,
        { action: "reconcile" },
      );
      setOrder(view);
      current.current = view;
      setMessage(
        view.status === "SUCCESS"
          ? "Original transaction and both recipient transfers verified."
          : "The original order is retained. Missing or uncertain evidence does not authorize a new payment.",
      );
    } catch {
      setMessage(
        "Could not check the original payment. Its evidence is preserved; try this read-only check again later.",
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function retry() {
    const o = current.current;
    if (!o?.submitted || !consent)
      throw new Error("Review and authorize the exact original retry first.");
    const view = await browserRequest<OrderView>(`/api/donations/${o.id}`, {
      action: "retry",
    });
    setOrder(view);
    current.current = view;
    setMessage(
      "Only the exact server-stored original envelope was retried. Check the original payment for verified results.",
    );
  }
  let fee = "Review in Freighter";
  try {
    if (order?.prepared) {
      const tx = TransactionBuilder.fromXDR(order.prepared.xdr, TESTNET);
      if (!(tx instanceof FeeBumpTransaction)) fee = `up to ${xlm(tx.fee)} XLM`;
    }
  } catch {}
  const success = order?.status === "SUCCESS",
    failed = order?.status === "CONFIRMED_FAILED";
  return (
    <div className="checkout-layout">
      <section className="panel checkout-summary">
        <div className="eyebrow">YOUR CONTRIBUTION</div>
        <h2>{campaign.title}</h2>
        <div className="checkout-amount">
          1 <span>XLM</span>
        </div>
        <p className="muted">STELLAR TESTNET · VALUELESS DEMO TOKENS</p>
        <div className="payout-row">
          <div>
            <strong>Direct relief</strong>
            <small>90% of your payment</small>
          </div>
          <strong>0.9 XLM</strong>
        </div>
        <p className="address small-address">{campaign.reliefAddress}</p>
        <div className="payout-row">
          <div>
            <strong>Logistics & operations</strong>
            <small>10% of your payment</small>
          </div>
          <strong>0.1 XLM</strong>
        </div>
        <p className="address small-address">{campaign.logisticsAddress}</p>
        <div className="payout-row fee-row">
          <span>Additional network fee</span>
          <strong>{fee}</strong>
        </div>
        <p className="fine-print">
          Freighter shows the full transaction and fee before you approve.
          Signing is handled by your wallet, never by AidFlow.
        </p>
      </section>
      <section className="panel checkout-actions">
        <div className="eyebrow">
          {success ? "TRANSFER EVIDENCE VERIFIED" : "YOU STAY IN CONTROL"}
        </div>
        <h2>
          {success
            ? "Care, with a clear trail."
            : failed
              ? "Original payment failed."
              : "Review. Approve. Follow."}
        </h2>
        {order && (
          <div className={`receipt-status ${success ? "verified" : ""}`}>
            {success
              ? "✓ VERIFIED SUCCESS"
              : failed
                ? "CONFIRMED FAILED"
                : order.status.replaceAll("_", " ")}
          </div>
        )}
        {success ? (
          <p>
            The original transaction reached final success, and both exact
            native XLM payouts match the saved recipient configuration.
          </p>
        ) : failed ? (
          <p>
            Final failure was established for the original transaction. Its
            evidence is kept in your history.
          </p>
        ) : (
          <>
            <div className="checkout-step">
              <span className="step-number">1</span>
              <div>
                <h3>Connect the donor wallet</h3>
                <button
                  className="button secondary"
                  disabled={busy || !storageReady}
                  onClick={() =>
                    run(async () => {
                      const address = await connectWallet();
                      if (
                        current.current &&
                        address !== current.current.walletAddress
                      )
                        throw new Error("Reconnect the original donor wallet.");
                      setWallet(address);
                    })
                  }
                >
                  {wallet ? "Reconnect Freighter" : "Connect Freighter"}
                </button>
                <p className="address small-address">
                  {wallet || "Desktop Chrome + Freighter · Testnet only"}
                </p>
              </div>
            </div>
            <label className="consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I authorize a fixed 1 Testnet XLM payment, split 0.9 / 0.1 to
                the displayed wallets, plus the network fee reviewed in
                Freighter.
              </span>
            </label>
            <div className="checkout-step">
              <span className="step-number">2</span>
              <div>
                <h3>Prepare and sign the original</h3>
                <div className="button-row">
                  <button
                    className="button secondary"
                    disabled={
                      busy ||
                      !storageReady ||
                      !consent ||
                      !wallet ||
                      Boolean(order && order.status !== "CREATED")
                    }
                    onClick={() => run(prepare)}
                  >
                    Prepare 1 XLM
                  </button>
                  <button
                    className="button secondary"
                    disabled={
                      busy ||
                      !storageReady ||
                      !consent ||
                      !order?.prepared ||
                      signed ||
                      order.submitted
                    }
                    onClick={() => run(sign)}
                  >
                    Sign in Freighter
                  </button>
                </div>
              </div>
            </div>
            <div className="checkout-step">
              <span className="step-number">3</span>
              <div>
                <h3>Submit your saved transaction</h3>
                <button
                  className="button"
                  disabled={
                    busy ||
                    !storageReady ||
                    !consent ||
                    (!signed && !order?.hasSignedEnvelope) ||
                    order?.submitted
                  }
                  onClick={() => run(submit)}
                >
                  Submit original payment ↗
                </button>
              </div>
            </div>
          </>
        )}
        {order && (
          <div className="original-record">
            <h3>Original payment record</h3>
            <p className="fine-print">Order {order.id}</p>
            {order.txHash && (
              <>
                <span className="muted">Original transaction hash</span>
                <p className="address">{order.txHash}</p>
                <a
                  className="text-link"
                  href={`https://stellar.expert/explorer/testnet/tx/${order.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on Stellar Testnet ↗
                </a>
              </>
            )}
            <button
              className="button secondary full"
              disabled={busy || !order.txHash}
              onClick={check}
            >
              Check original payment
            </button>
            {!success &&
              !failed &&
              order.submitted &&
              order.hasSignedEnvelope && (
                <details>
                  <summary>Original submission interrupted?</summary>
                  <p className="fine-print">
                    Check the original first. After one minute you may
                    explicitly retry its exact stored envelope. This never
                    creates a replacement transaction.
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy || !consent || !storageReady}
                    onClick={() => run(retry)}
                  >
                    Retry exact saved envelope
                  </button>
                </details>
              )}
            <Link href="/dashboard" className="text-link">
              Your donation history →
            </Link>
          </div>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {busy && <p role="status">Working with the original payment…</p>}
        <p className="fine-print">
          Refreshing preserves the server order. If a result is uncertain, check
          the original payment. Do not clear browser recovery or create a
          replacement.
        </p>
      </section>
    </div>
  );
}
