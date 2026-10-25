export type PaymentSnapshot = {
  deploymentId: string;
  baseUrl: string;
  version: number;
  triggerContract: string;
  splitContract: string;
  reliefAddress: string;
  logisticsAddress: string;
};
export type TransferEvent = {
  id: string;
  contract: string;
  topics: unknown[];
  amount: string;
};
export type ChainProof = {
  status: string;
  txHash: string;
  network: string;
  payer: string;
  ledger: number;
  nativeContract: string;
  events: TransferEvent[];
};
export function verifyReceipt(
  snapshot: PaymentSnapshot,
  payer: string,
  hash: string,
  proof: ChainProof,
): { status: string; evidence: TransferEvent[] } {
  const result = (status: string, evidence: TransferEvent[] = []) => ({
    status,
    evidence,
  });
  if (["NOT_FOUND", "UNKNOWN", "PENDING"].includes(proof.status))
    return result("PENDING_VERIFICATION");
  if (
    proof.txHash !== hash ||
    proof.network !== "testnet" ||
    proof.payer !== payer ||
    snapshot.reliefAddress === snapshot.logisticsAddress
  )
    return result("NEEDS_OPERATOR_REVIEW");
  if (!Number.isSafeInteger(proof.ledger) || proof.ledger < 1)
    return result("PENDING_VERIFICATION");
  if (proof.status === "FAILED") return result("CONFIRMED_FAILED");
  if (proof.status !== "SUCCESS") return result("PENDING_VERIFICATION");
  const transfers = proof.events.filter(
    (e) =>
      e.contract === proof.nativeContract &&
      e.topics[0] === "transfer" &&
      e.topics[3] === "native",
  );
  const matches = (from: string, to: string, amount: string) =>
    transfers.filter(
      (e) => e.topics[1] === from && e.topics[2] === to && e.amount === amount,
    );
  const relief = matches(
    snapshot.splitContract,
    snapshot.reliefAddress,
    "9000000",
  );
  const logistics = matches(
    snapshot.splitContract,
    snapshot.logisticsAddress,
    "1000000",
  );
  if (
    matches(payer, snapshot.triggerContract, "10000000").length !== 1 ||
    matches(snapshot.triggerContract, snapshot.splitContract, "10000000")
      .length !== 1 ||
    relief.length !== 1 ||
    logistics.length !== 1
  )
    return result("PENDING_VERIFICATION");
  if (
    transfers.filter((e) => e.topics[1] === snapshot.splitContract).length !==
      2 ||
    new Set(proof.events.map((e) => e.id)).size !== proof.events.length
  )
    return result("NEEDS_OPERATOR_REVIEW");
  return result("SUCCESS", [relief[0]!, logistics[0]!]);
}
