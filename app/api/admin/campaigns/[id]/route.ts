import { requireAdmin } from "@/lib/identity";
import { sameOrigin, readJson } from "@/lib/http";
import { appHandle, userBudget } from "@/lib/app-api";
import { reviewCampaign } from "@/lib/campaigns";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return appHandle(async () => {
    sameOrigin(request);
    const actor = await requireAdmin();
    await userBudget(actor.id, "review");
    await reviewCampaign(
      actor,
      (await context.params).id,
      await readJson(request),
    );
    return { saved: true };
  });
}
