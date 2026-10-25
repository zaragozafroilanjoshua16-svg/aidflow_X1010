import { readRecovery, saveRecovery } from "./recovery";
export function retireFinalIntent(
  storage: Pick<Storage, "getItem" | "removeItem">,
  key: string,
  orderId: string,
  status: string,
): void {
  if (status !== "SUCCESS" && status !== "CONFIRMED_FAILED") return;
  const raw = storage.getItem(key);
  if (!raw) return;
  const intent = JSON.parse(raw);
  if (intent.orderId !== orderId) return;
  storage.removeItem(key);
  if (storage.getItem(key) !== null)
    throw new Error("Cannot retire the completed creation request.");
}
export function updateLegacyResult(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  result: { txHash: string; network?: string; status: string },
): void {
  if (
    !key.startsWith("paiflow-sdk-payment-v2:") ||
    result.network !== "testnet" ||
    !["SUCCESS", "FAILED"].includes(result.status)
  )
    return;
  const raw = storage.getItem(key);
  if (!raw) return;
  const scope = key.slice("paiflow-sdk-payment-v2:".length),
    record = readRecovery(scope, raw);
  if (record.prepared.txHash !== result.txHash) return;
  saveRecovery(storage, key, { ...record, status: result.status });
}
