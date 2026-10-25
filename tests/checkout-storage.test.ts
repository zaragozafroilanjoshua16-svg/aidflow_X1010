import { expect, it } from "vitest";
import { retireFinalIntent, updateLegacyResult } from "@/lib/checkout-storage";
import { fixtureAddress, fixturePrepared } from "./transaction-fixture";
import { envelopeHash } from "@/lib/transaction";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
it("only retires the matching creation intent after trusted terminal state", () => {
  const s = storage();
  s.setItem(
    "intent",
    JSON.stringify({ orderId: "order", wallet: "wallet", key: "original" }),
  );
  retireFinalIntent(s, "intent", "other", "SUCCESS");
  expect(s.getItem("intent")).not.toBeNull();
  retireFinalIntent(s, "intent", "order", "PENDING_VERIFICATION");
  expect(s.getItem("intent")).not.toBeNull();
  retireFinalIntent(s, "intent", "order", "SUCCESS");
  expect(s.getItem("intent")).toBeNull();
});
it("updates only the matching legacy original record after final status without deleting evidence", () => {
  const s = storage(),
    scope = "https://platform.example/deployment",
    key = `paiflow-sdk-payment-v2:${scope}`;
  const prepared = {
    ...fixturePrepared,
    txHash: envelopeHash(fixturePrepared.xdr),
  };
  const raw = JSON.stringify({
    version: 2,
    scope,
    address: fixtureAddress,
    prepared,
    attempted: true,
    status: "UNKNOWN",
  });
  s.setItem(key, raw);
  updateLegacyResult(s, key, {
    txHash: "b".repeat(64),
    network: "testnet",
    status: "SUCCESS",
  });
  expect(s.getItem(key)).toBe(raw);
  updateLegacyResult(s, key, {
    txHash: prepared.txHash,
    network: "testnet",
    status: "UNKNOWN",
  });
  expect(s.getItem(key)).toBe(raw);
  updateLegacyResult(s, key, {
    txHash: prepared.txHash,
    network: "testnet",
    status: "SUCCESS",
  });
  const updated = JSON.parse(s.getItem(key)!);
  expect(updated.status).toBe("SUCCESS");
  expect(updated.prepared).toEqual(prepared);
});
