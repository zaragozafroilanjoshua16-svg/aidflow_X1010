import { redirect } from "next/navigation";
import { currentUser } from "@/lib/identity";
import { submittedCampaigns } from "@/lib/campaigns";
import { database } from "@/lib/db";
import { AdminReview } from "@/components/admin-review";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=%2Fadmin");
  if (user.role !== "ADMIN")
    return (
      <main className="narrow-page">
        <h1>Administrator access required.</h1>
        <p>
          Your account can browse, donate and submit campaigns. Review access is
          assigned through trusted local setup.
        </p>
      </main>
    );
  const campaigns = await submittedCampaigns(user, true),
    reviews = (
      await database().query(
        "SELECT r.decision,r.reason,r.created_at,c.title FROM campaign_reviews r JOIN campaigns c ON c.id=r.campaign_id ORDER BY r.created_at DESC LIMIT 20",
      )
    ).rows;
  return (
    <main className="detail-page">
      <div className="page-heading">
        <div className="eyebrow">MANUAL DEMO GOVERNANCE</div>
        <h1>
          A thoughtful review.
          <br />
          <em>A clear decision.</em>
        </h1>
        <p>
          Review synthetic evidence, consent and wallet control. Approval and
          blockchain activation are separate.
        </p>
      </div>
      <div className="notice">
        Only the preverified seeded demo may accept Testnet payments. These
        controls cannot mark a donation successful or change approved wallets.
      </div>
      {campaigns.map((c) => (
        <section key={c.id} className="panel admin-campaign">
          <div className="section-heading">
            <h2>{c.title}</h2>
            <span className="status-pill pending">
              {c.review_status.replaceAll("_", " ")}
            </span>
          </div>
          <p>{c.description}</p>
          <p className="fine-print">
            {c.region} · {c.beneficiary_type} · Consent{" "}
            {c.consent_attested ? "attested" : "missing"} · Fundraising{" "}
            {c.fundraising_status}
          </p>
          <AdminReview id={c.id} isSeeded={c.is_seeded} />
        </section>
      ))}
      <section className="panel">
        <h2>Private review history</h2>
        {reviews.length ? (
          reviews.map((r, i) => (
            <div className="review-history" key={i}>
              <strong>
                {r.title} · {r.decision}
              </strong>
              <p>{r.reason}</p>
              <small>
                {new Date(r.created_at).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </small>
            </div>
          ))
        ) : (
          <p className="muted">No review decisions yet.</p>
        )}
      </section>
    </main>
  );
}
