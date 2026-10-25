import { expect, it } from "vitest";
import { verifyReceipt } from "@/lib/receipt";
const snapshot = {
  deploymentId: "d6de37c1-be25-4e3c-a0ef-e3e6cce4193c",
  baseUrl: "https://beta.app.paiflow.xyz",
  version: 1,
  triggerContract: "trigger",
  splitContract: "split",
  reliefAddress: "relief",
  logisticsAddress: "logistics",
};
const transfer = (from: string, to: string, amount: string, id: string) => ({
  id,
  contract: "native",
  topics: ["transfer", from, to, "native"],
  amount,
});
const proof = {
  status: "SUCCESS",
  txHash: "a".repeat(64),
  network: "testnet",
  payer: "donor",
  ledger: 5377436,
  nativeContract: "native",
  events: [
    transfer("donor", "trigger", "10000000", "1"),
    transfer("trigger", "split", "10000000", "2"),
    transfer("split", "relief", "9000000", "3"),
    transfer("split", "logistics", "1000000", "4"),
  ],
};
it("requires successful original hash, Testnet payer and exact native transfer chain", () => {
  expect(verifyReceipt(snapshot, "donor", "a".repeat(64), proof).status).toBe(
    "SUCCESS",
  );
  for (const change of [
    { status: "PENDING" },
    { txHash: "b".repeat(64) },
    { network: "mainnet" },
    { payer: "other" },
  ])
    expect(
      verifyReceipt(snapshot, "donor", "a".repeat(64), { ...proof, ...change })
        .status,
    ).not.toBe("SUCCESS");
});
it("never treats percentage-only payout events or missing transfer evidence as success", () => {
  expect(
    verifyReceipt(snapshot, "donor", "a".repeat(64), {
      ...proof,
      events: proof.events.slice(0, 2),
    }).status,
  ).toBe("PENDING_VERIFICATION");
  expect(
    verifyReceipt(snapshot, "donor", "a".repeat(64), { ...proof, events: [] })
      .status,
  ).toBe("PENDING_VERIFICATION");
});
it("rejects wrong asset, recipients, split amounts, duplicate or extra split transfers", () => {
  for (const events of [
    proof.events.map((e) =>
      e.id === "3" ? { ...e, contract: "fake-token" } : e,
    ),
    proof.events.map((e) =>
      e.id === "3" ? transfer("split", "attacker", "9000000", "3") : e,
    ),
    proof.events.map((e) => (e.id === "3" ? { ...e, amount: "8999999" } : e)),
    [...proof.events, transfer("split", "attacker", "1", "5")],
    [...proof.events, proof.events[2]!],
  ])
    expect(
      verifyReceipt(snapshot, "donor", "a".repeat(64), { ...proof, events })
        .status,
    ).not.toBe("SUCCESS");
});
it("keeps not-found and uncertain failures unresolved", () => {
  expect(
    verifyReceipt(snapshot, "donor", "a".repeat(64), {
      ...proof,
      status: "NOT_FOUND",
    }).status,
  ).toBe("PENDING_VERIFICATION");
  expect(
    verifyReceipt(snapshot, "donor", "a".repeat(64), {
      ...proof,
      status: "FAILED",
    }).status,
  ).toBe("CONFIRMED_FAILED");
  expect(
    verifyReceipt(snapshot, "donor", "a".repeat(64), {
      ...proof,
      status: "NOT_FOUND",
      payer: "",
      ledger: 0,
    }).status,
  ).toBe("PENDING_VERIFICATION");
});
