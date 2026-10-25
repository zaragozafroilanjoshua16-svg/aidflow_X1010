import "server-only";
import { AccessError } from "@/lib/identity-policy";
import { RequestError, handle } from "@/lib/http";
import { database } from "@/lib/db";
export async function appHandle(action: () => Promise<unknown>) {
  return handle(async () => {
    try {
      return await action();
    } catch (error) {
      if (error instanceof AccessError)
        throw new RequestError(error.status, "AUTHORIZATION", error.message);
      if ((error as { code?: string })?.code === "23505")
        throw new RequestError(
          409,
          "CONFLICT",
          "An original order already exists. Open your dashboard to recover it.",
        );
      throw error;
    }
  });
}
/** Shared durable per-account budget, independent of forwarding headers. */
export async function userBudget(userId: string, action: string, limit = 30) {
  const row = (
    await database().query(
      `INSERT INTO request_budgets(bucket,starts_at,used) VALUES($1,now(),1)
    ON CONFLICT(bucket) DO UPDATE SET used=CASE WHEN request_budgets.starts_at < now()-interval '1 minute' THEN 1 ELSE request_budgets.used+1 END,
    starts_at=CASE WHEN request_budgets.starts_at < now()-interval '1 minute' THEN now() ELSE request_budgets.starts_at END RETURNING used`,
      [`${userId}:${action}`],
    )
  ).rows[0];
  if (row.used > limit)
    throw new RequestError(
      429,
      "RATE_LIMITED",
      "Please wait before checking again.",
      60,
    );
}
