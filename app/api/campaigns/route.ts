import { requireUser } from "@/lib/identity";
import { sameOrigin, readJson } from "@/lib/http";
import { appHandle, userBudget } from "@/lib/app-api";
import { submitCampaign } from "@/lib/campaigns";
export async function POST(request: Request) {
  return appHandle(async () => {
    sameOrigin(request);
    const actor = await requireUser();
    await userBudget(actor.id, "campaign", 5);
    const c = await submitCampaign(actor, await readJson(request));
    return { id: c.id, slug: c.slug, reviewStatus: c.review_status };
  });
}
