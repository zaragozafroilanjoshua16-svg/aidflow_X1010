import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/identity";
import { listOrders } from "@/lib/orders";
import { submittedCampaigns } from "@/lib/campaigns";
import { CampaignForm } from "@/components/campaign-form";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=%2Fdashboard");
  const [orders, campaigns] = await Promise.all([
    listOrders(user),
    submittedCampaigns(user),
  ]);
  return (
    <main className="detail-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR CARE, IN ONE PLACE</div>
        <h1>
          Welcome back,
          <br />
          <em>{user.name?.split(" ")[0] || "neighbor"}.</em>
        </h1>
        <p>
          Your original orders and campaign applications stay here when you
          return.
        </p>
      </div>
      <div className="dashboard-grid">
        <div>
          <section className="panel">
            <div className="section-heading">
              <h2>Your donations</h2>
              <span className="badge">TESTNET</span>
            </div>
            {orders.length ? (
              orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/donations/${o.id}`}
                  className="history-row"
                >
                  <div>
                    <strong>{o.title}</strong>
                    <small>
                      {new Date(o.createdAt).toLocaleDateString("en-PH", {
                        timeZone: "Asia/Manila",
                      })}{" "}
                      · 1 XLM
                    </small>
                  </div>
                  <span
                    className={`status-pill ${o.status === "SUCCESS" ? "" : "pending"}`}
                  >
                    {o.status === "SUCCESS"
                      ? "Verified success"
                      : o.status.replaceAll("_", " ").toLowerCase()}{" "}
                    ↗
                  </span>
                </Link>
              ))
            ) : (
              <div className="empty-state">
                <span>↗</span>
                <h3>Your first act starts here.</h3>
                <p>
                  No AidFlow donations yet. Only verified orders appear as
                  successful.
                </p>
                <Link className="text-link" href="/#campaigns">
                  Explore the demo campaign →
                </Link>
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Your campaigns</h2>
            {campaigns.length ? (
              campaigns.map((c) => (
                <div className="history-row" key={c.id}>
                  <div>
                    <strong>{c.title}</strong>
                    <small>
                      {c.fundraising_status.replaceAll("_", " ").toLowerCase()}
                    </small>
                  </div>
                  <span className="status-pill pending">
                    {c.review_status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">No submitted campaigns yet.</p>
            )}
          </section>
          <p className="fine-print">
            <Link href="/starter/recover">
              Recover a pre-AidFlow starter transaction →
            </Link>
          </p>
        </div>
        <section className="panel">
          <div className="eyebrow">START WITH A STORY</div>
          <h2>Submit a demo campaign.</h2>
          <p>
            For an individual, family or organization. An administrator reviews
            synthetic evidence before deciding.
          </p>
          <CampaignForm />
        </section>
      </div>
    </main>
  );
}
