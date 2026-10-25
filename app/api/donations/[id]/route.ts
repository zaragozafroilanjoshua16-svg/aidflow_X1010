import { requireUser } from "@/lib/identity";
import {
  getOrder,
  prepareOrder,
  submitOrder,
  reconcileOrder,
} from "@/lib/orders";
import { sameOrigin, readJson, RequestError } from "@/lib/http";
import { appHandle, userBudget } from "@/lib/app-api";
import { limitPaymentRequests } from "@/lib/payment-rate-limit";
import { object } from "@/lib/validation";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const response = await appHandle(async () =>
    getOrder(await requireUser(), (await context.params).id),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return appHandle(async () => {
    sameOrigin(request);
    limitPaymentRequests("request");
    const actor = await requireUser(),
      id = (await context.params).id;
    const b = object(await readJson(request), ["action", "signedXdr"]);
    if (b.action === "prepare" && Object.keys(b).length === 1) {
      limitPaymentRequests("prepare");
      await userBudget(actor.id, "prepare", 20);
      return prepareOrder(actor, id);
    }
    if (
      b.action === "submit" &&
      (b.signedXdr === undefined || typeof b.signedXdr === "string")
    ) {
      limitPaymentRequests("submit");
      await userBudget(actor.id, "submit", 20);
      return submitOrder(actor, id, b.signedXdr as string | undefined);
    }
    if (b.action === "retry" && Object.keys(b).length === 1) {
      limitPaymentRequests("submit");
      await userBudget(actor.id, "submit", 20);
      return submitOrder(actor, id, undefined, true);
    }
    if (b.action === "reconcile" && Object.keys(b).length === 1) {
      limitPaymentRequests("status");
      await userBudget(actor.id, "status", 120);
      return reconcileOrder(actor, id);
    }
    throw new RequestError(400, "VALIDATION", "Unsupported donation action.");
  });
}
