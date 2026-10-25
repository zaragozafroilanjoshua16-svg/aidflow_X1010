import { requireUser } from "@/lib/identity";
import { createOrder } from "@/lib/orders";
import { sameOrigin, readJson } from "@/lib/http";
import { appHandle, userBudget } from "@/lib/app-api";
import { limitPaymentRequests } from "@/lib/payment-rate-limit";
export async function POST(request: Request) {
  return appHandle(async () => {
    sameOrigin(request);
    limitPaymentRequests("request");
    const actor = await requireUser();
    await userBudget(actor.id, "create-order", 20);
    return createOrder(actor, await readJson(request));
  });
}
