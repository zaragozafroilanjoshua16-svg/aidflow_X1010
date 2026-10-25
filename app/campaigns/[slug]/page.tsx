import Link from "next/link";
import { notFound } from "next/navigation";
import { campaignBySlug } from "@/lib/campaigns";
import { CampaignArt } from "@/components/campaign-art";
import { xlm, progress } from "@/lib/display";
export const dynamic = "force-dynamic";
export default async function CampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const c = await campaignBySlug((await params).slug);
  if (!c) notFound();
  const active = c.fundraising_status === "ACTIVE" && c.ready;
  return (
    <main className="detail-page">
      <Link href="/#campaigns" className="back-link">
        ← All campaigns
      </Link>
      <div className="campaign-title">
        <div className="eyebrow">{c.region.toUpperCase()} · PHILIPPINES</div>
        <h1>
          {c.title}
          <span className="serif-dot">.</span>
        </h1>
        <div className="inline-tags">
          <span className="badge">FICTIONAL DEMO</span>
          <span className="status-pill">Manual review approved</span>
          <span className="muted">{c.disaster_type} relief</span>
        </div>
      </div>
      <div className="detail-grid">
        <article>
          <CampaignArt />
          <section className="story-section">
            <div className="eyebrow">THE STORY</div>
            <h2>
              A place to feel
              <br />
              <em>safe again.</em>
            </h2>
            <p className="story-text">{c.description}</p>
            <div className="notice">
              Synthetic campaign, synthetic consent and illustrative goals. No
              real beneficiaries or automated KYC are claimed. Testnet transfers
              do not represent real funds raised.
            </div>
            <h3>Two purposes. One contribution.</h3>
            <p>
              Every fixed 1 XLM payment follows the approved 90/10 distribution.
              We verify the original transaction and the actual token transfers
              before counting it toward progress.
            </p>
            <div className="split-cards">
              <div>
                <strong>90%</strong>
                <h4>Direct relief</h4>
                <p>0.9 Testnet XLM</p>
              </div>
              <div>
                <strong>10%</strong>
                <h4>Logistics & operations</h4>
                <p>0.1 Testnet XLM</p>
              </div>
            </div>
            <h3>Approved public recipients</h3>
            <dl className="wallet-list">
              <dt>Relief wallet · 90%</dt>
              <dd>{c.relief_address || "Not configured"}</dd>
              <dt>Logistics wallet · 10%</dt>
              <dd>{c.logistics_address || "Not configured"}</dd>
            </dl>
            <p className="fine-print">
              Wallet control and fictional consent were reviewed manually for
              this demo. Blockchain confirms transfers, not the delivery of
              supplies.
            </p>
          </section>
        </article>
        <aside className="donation-panel panel">
          <div className="eyebrow">A LITTLE CARE GOES A LONG WAY</div>
          <div className="raised">
            <strong>{xlm(c.verified_stroops)}</strong>
            <span>verified Testnet XLM</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Verified campaign progress"
            aria-valuenow={progress(c.verified_stroops, c.xlm_goal_stroops)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              style={{
                width: `${progress(c.verified_stroops, c.xlm_goal_stroops)}%`,
              }}
            />
          </div>
          <div className="progress-label">
            <span>Illustrative {xlm(c.xlm_goal_stroops)} XLM goal</span>
            <strong>{c.verified_count} verified payments</strong>
          </div>
          <hr />
          <h3>Start with 1 XLM</h3>
          <p>
            90% relief · 10% logistics
            <br />
            Network fees are additional.
          </p>
          {active ? (
            <Link className="button full" href={`/campaigns/${c.slug}/donate`}>
              Donate 1 Testnet XLM ↗
            </Link>
          ) : (
            <div className="notice">
              New payments are{" "}
              {c.fundraising_status === "PAUSED" ? "paused" : "not ready"}.
              Existing orders remain available in your dashboard.
            </div>
          )}
          <div className="payment-trust">
            <span>✓ Google sign-in required</span>
            <span>✓ You approve in Freighter</span>
            <span>✓ Exact payout verification</span>
          </div>
          <p className="fine-print">
            DEMO / TESTNET · Valueless tokens.
            <br />
            Desktop Chrome + Freighter is the demo checkout.
          </p>
        </aside>
      </div>
    </main>
  );
}
