import "server-only";
import { database, withTransaction } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/identity-policy";
import { RequestError } from "@/lib/http";
import { object, text, uuid } from "@/lib/validation";
import { randomUUID } from "node:crypto";
export type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string;
  region: string;
  country: string;
  disaster_type: string;
  beneficiary_type: string;
  review_status: string;
  fundraising_status: string;
  is_demo: boolean;
  is_seeded: boolean;
  consent_attested: boolean;
  xlm_goal_stroops: string;
  verified_stroops: string;
  verified_count: string;
  relief_address: string | null;
  logistics_address: string | null;
  ready: boolean | null;
  created_at: Date;
};
const publicSelect = `SELECT c.id,c.slug,c.title,c.description,c.region,c.country,c.disaster_type,c.beneficiary_type,
  c.review_status,c.fundraising_status,c.is_demo,c.is_seeded,c.consent_attested,c.xlm_goal_stroops,c.created_at,
  pc.relief_address,pc.logistics_address,pc.ready,
  COALESCE((SELECT sum(o.amount_stroops) FROM donation_orders o WHERE o.campaign_id=c.id AND o.status='SUCCESS'),0)::text AS verified_stroops,
  (SELECT count(*)::text FROM donation_orders o WHERE o.campaign_id=c.id AND o.status='SUCCESS') AS verified_count
  FROM campaigns c LEFT JOIN campaign_payment_configs pc ON pc.id=c.active_config_id`;
export async function publicCampaigns() {
  return (
    await database().query<Campaign>(
      `${publicSelect} WHERE c.review_status='APPROVED' ORDER BY c.is_seeded DESC,c.created_at DESC LIMIT 30`,
    )
  ).rows;
}
export async function campaignBySlug(slug: string) {
  return (
    (
      await database().query<Campaign>(
        `${publicSelect} WHERE c.slug=$1 AND c.review_status='APPROVED'`,
        [slug],
      )
    ).rows[0] || null
  );
}
export async function submittedCampaigns(actor: Actor, admin = false) {
  requireActor(actor, admin);
  return (
    await database().query<Campaign>(
      `${publicSelect} WHERE ${admin ? "true" : "c.creator_user_id=$1"} ORDER BY c.created_at DESC LIMIT 100`,
      admin ? [] : [actor.id],
    )
  ).rows;
}
export async function submitCampaign(
  actor: Actor,
  body: unknown,
): Promise<Campaign> {
  requireActor(actor);
  const b = object(body, [
    "title",
    "description",
    "disasterType",
    "region",
    "beneficiaryType",
    "consent",
  ]);
  const title = text(b.title, 6, 120),
    description = text(b.description, 30, 8000),
    region = text(b.region, 2, 120);
  const disaster = text(b.disasterType, 2, 50);
  if (
    !["FAMILY", "ORGANIZATION"].includes(String(b.beneficiaryType)) ||
    b.consent !== true
  )
    throw new RequestError(
      400,
      "VALIDATION",
      "Attest fictional beneficiary consent and select a beneficiary type.",
    );
  return withTransaction(async (c) => {
    const id = randomUUID(),
      slug = `demo-${id.slice(0, 12)}`;
    const row = (
      await c.query<Campaign>(
        `INSERT INTO campaigns(id,creator_user_id,slug,title,description,disaster_type,country,region,beneficiary_type,consent_attested)
      VALUES($1,$2,$3,$4,$5,$6,'PH',$7,$8,true) RETURNING *`,
        [
          id,
          actor.id,
          slug,
          title,
          description,
          disaster,
          region,
          b.beneficiaryType,
        ],
      )
    ).rows[0]!;
    await c.query(
      "INSERT INTO audit_logs(actor_user_id,action,entity_id) VALUES($1,'CAMPAIGN_SUBMITTED',$2)",
      [actor.id, id],
    );
    return row;
  });
}
export async function reviewCampaign(
  actor: Actor,
  id: string,
  body: unknown,
): Promise<void> {
  requireActor(actor, true);
  uuid(id);
  const b = object(body, ["decision", "reason"]),
    reason = text(b.reason, 3, 2000);
  const decision = text(b.decision, 3, 30);
  if (
    ![
      "UNDER_REVIEW",
      "APPROVED",
      "NEEDS_CHANGES",
      "REJECTED",
      "ACTIVATE",
      "PAUSE",
    ].includes(decision)
  )
    throw new RequestError(400, "VALIDATION", "Unsupported review decision.");
  await withTransaction(async (c) => {
    const row = (
      await c.query(
        `SELECT c.*,p.ready,p.deployment_uuid,p.verification_hash FROM campaigns c
      LEFT JOIN campaign_payment_configs p ON p.id=c.active_config_id WHERE c.id=$1 FOR UPDATE OF c`,
        [id],
      )
    ).rows[0];
    if (!row) throw new RequestError(404, "NOT_FOUND", "Campaign not found.");
    if (decision === "ACTIVATE") {
      if (
        !row.is_seeded ||
        row.review_status !== "APPROVED" ||
        !row.ready ||
        !row.verification_hash ||
        row.deployment_uuid !== process.env.PAIFLOW_DEPLOYMENT_ID
      )
        throw new RequestError(
          409,
          "NOT_READY",
          "Only the preverified demo configuration can accept payments.",
        );
      await c.query(
        "UPDATE campaigns SET fundraising_status='ACTIVE',updated_at=now() WHERE id=$1",
        [id],
      );
    } else if (decision === "PAUSE") {
      await c.query(
        "UPDATE campaigns SET fundraising_status='PAUSED',updated_at=now() WHERE id=$1",
        [id],
      );
    } else {
      if (decision === "APPROVED" && !row.consent_attested)
        throw new RequestError(
          409,
          "NOT_READY",
          "Fictional consent attestation is required.",
        );
      await c.query(
        `UPDATE campaigns SET review_status=$2,fundraising_status=CASE WHEN $2='APPROVED' THEN fundraising_status ELSE 'NOT_READY' END,updated_at=now() WHERE id=$1`,
        [id, decision],
      );
    }
    await c.query(
      "INSERT INTO campaign_reviews(campaign_id,admin_user_id,decision,reason) VALUES($1,$2,$3,$4)",
      [id, actor.id, decision, reason],
    );
    await c.query(
      "INSERT INTO audit_logs(actor_user_id,action,entity_id,metadata) VALUES($1,'CAMPAIGN_REVIEW',$2,$3)",
      [actor.id, id, JSON.stringify({ decision, reason })],
    );
  });
}
