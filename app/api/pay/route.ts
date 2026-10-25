import { paymentStatus } from "@/lib/paiflow";
import { prepareOrder, submitOrder, reconcileOrder } from "@/lib/orders";
import { requireUser } from "@/lib/identity";
import { sameOrigin, readJson, RequestError } from "@/lib/http";
import { appHandle, userBudget } from "@/lib/app-api";
import { limitPaymentRequests } from "@/lib/payment-rate-limit";
import { object } from "@/lib/validation";
export async function POST(request: Request) {
  return appHandle(async () => {
    sameOrigin(request);
    limitPaymentRequests("request");
    const actor = await requireUser();
    const b = object(await readJson(request), [
      "action",
      "orderId",
      "signedXdr",
      "txHash",
    ]);
    if (
      b.action === "prepare" &&
      typeof b.orderId === "string" &&
      Object.keys(b).length === 2
    ) {
      limitPaymentRequests("prepare");
      await userBudget(actor.id, "prepare", 20);
      return prepareOrder(actor, b.orderId);
    }
    if (
      b.action === "submit" &&
      typeof b.orderId === "string" &&
      typeof b.signedXdr === "string" &&
      b.signedXdr.length <= 200000 &&
      Object.keys(b).length === 3
    ) {
      limitPaymentRequests("submit");
      await userBudget(actor.id, "submit", 20);
      return submitOrder(actor, b.orderId, b.signedXdr);
    }
    if (
      b.action === "status" &&
      Object.keys(b).length === 2 &&
      (typeof b.orderId === "string" || typeof b.txHash === "string")
    ) {
      limitPaymentRequests("status");
      await userBudget(actor.id, "status", 120);
      // Starter recovery may only read a public hash; it cannot prepare an unbound
      // payment or contribute to AidFlow progress.
      return typeof b.orderId === "string"
        ? reconcileOrder(actor, b.orderId)
        : paymentStatus(b.txHash as string);
    }
    throw new RequestError(
      400,
      "VALIDATION",
      "Use an authenticated saved donation order.",
    );
  });
}
