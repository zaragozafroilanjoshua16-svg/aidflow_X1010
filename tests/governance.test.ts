import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { testDatabase } from "./db-helper";
import { submitCampaign, reviewCampaign } from "@/lib/campaigns";
import type { Pool } from "pg";
let pool: Pool;
let close: () => Promise<void>;
let user: { id: string; role: "USER" };
let admin: { id: string; role: "ADMIN" };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  database: () => pool,
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const r = await fn(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  },
}));
beforeAll(async () => {
  ({ pool, close } = await testDatabase());
  const u = (
    await pool.query(
      "INSERT INTO users(email) VALUES('user@example.invalid') RETURNING id",
    )
  ).rows[0];
  user = { id: u.id, role: "USER" };
  const a = (
    await pool.query(
      "INSERT INTO users(email,role) VALUES('admin@example.invalid','ADMIN') RETURNING id",
    )
  ).rows[0];
  admin = { id: a.id, role: "ADMIN" };
});
afterAll(async () => {
  await close?.();
});
const application = {
  title: "Fictional family relief",
  description: "A synthetic flood relief campaign for demo testing only.",
  disasterType: "flood",
  region: "Eastern Visayas",
  beneficiaryType: "FAMILY",
  consent: true,
};
it("submits for a signed-in USER without granting approval or live checkout", async () => {
  const c = await submitCampaign(user, application);
  expect(c.review_status).toBe("SUBMITTED");
  expect(c.fundraising_status).toBe("NOT_READY");
  await expect(
    submitCampaign(user, { ...application, role: "ADMIN" }),
  ).rejects.toThrow();
});
it("requires admin authorization and audited reasons, keeping approval separate from activation", async () => {
  const c = await submitCampaign(user, application);
  await expect(
    reviewCampaign(user, c.id, {
      decision: "APPROVED",
      reason: "Reviewed synthetic evidence",
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    reviewCampaign(admin, c.id, { decision: "APPROVED", reason: "" }),
  ).rejects.toThrow();
  await reviewCampaign(admin, c.id, {
    decision: "APPROVED",
    reason: "Reviewed synthetic evidence and fictional consent",
  });
  const row = (await pool.query("SELECT * FROM campaigns WHERE id=$1", [c.id]))
    .rows[0];
  expect(row.review_status).toBe("APPROVED");
  expect(row.fundraising_status).toBe("NOT_READY");
  await expect(
    reviewCampaign(admin, c.id, {
      decision: "ACTIVATE",
      reason: "Want payments",
    }),
  ).rejects.toThrow();
  expect(
    (
      await pool.query(
        "SELECT count(*) FROM campaign_reviews WHERE campaign_id=$1",
        [c.id],
      )
    ).rows[0].count,
  ).toBe("1");
});
