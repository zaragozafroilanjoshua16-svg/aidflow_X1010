import Link from "next/link";
import { publicCampaigns, type Campaign } from "@/lib/campaigns";
import { CampaignCard } from "@/components/campaign-card";
import { CampaignArt } from "@/components/campaign-art";
export const dynamic = "force-dynamic";
export default async function Home() {
  let campaigns: Campaign[] = [];
  let unavailable = false;
  try {
    campaigns = await publicCampaigns();
  } catch {
    unavailable = true;
  }
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-spark">✳</span> RELIEF THAT REACHES PEOPLE
          </div>
          <h1>
            Small acts.
            <br />
            Clear <em>impact.</em>
          </h1>
          <p>
            When a disaster turns life upside down, every act of care matters.
            Follow your contribution from your wallet to the people helping a
            community rebuild.
          </p>
          <div className="hero-actions">
            <Link className="button" href="#campaigns">
              Explore the demo <span>↗</span>
            </Link>
            <Link className="quiet-link" href="#how-it-works">
              <span className="play-icon">▶</span> See how it flows
            </Link>
          </div>
          <div className="hero-note">
            <span className="note-icon">✓</span>
            <span>
              One contribution. Two clear purposes.
              <br />
              <strong>90% relief · 10% logistics</strong>
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <CampaignArt />
          <div className="visual-tag">
            <span className="tag-icon">↗</span>
            <div>
              <strong>A little help. A new beginning.</strong>
              <span>Fictional Eastern Visayas relief campaign</span>
            </div>
          </div>
          <div className="visual-stamp">
            CARE
            <br />
            <span>IN MOTION</span> ✳
          </div>
        </div>
      </section>
      <div className="demo-banner">
        <span className="status-dot" />
        <strong>A safe space to demonstrate giving.</strong>
        <span>
          All campaigns are fictional. All payments use valueless Testnet XLM.
        </span>
        <span className="badge">DEMO / TESTNET</span>
      </div>
      <section className="impact-strip" aria-label="Donation distribution">
        <div>
          <span className="metric-number">
            90<span>%</span>
          </span>
          <p>
            Direct relief
            <br />
            <small>Approved relief wallet</small>
          </p>
        </div>
        <div>
          <span className="metric-number">
            10<span>%</span>
          </span>
          <p>
            Getting help there
            <br />
            <small>Approved logistics wallet</small>
          </p>
        </div>
        <div>
          <span className="metric-symbol">↗</span>
          <p>
            Every transfer traceable
            <br />
            <small>Verified on Stellar Testnet</small>
          </p>
        </div>
      </section>
      <section id="campaigns" className="campaigns-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A COMMUNITY WORTH SHOWING UP FOR</div>
            <h2>
              A small start. <em>A shared future.</em>
            </h2>
          </div>
          <span className="badge light">FICTIONAL CAMPAIGNS</span>
        </div>
        <div className="campaign-grid">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
          <aside className="community-card">
            <span className="community-symbol">✳</span>
            <div>
              <div className="eyebrow">CARE STARTS WITH A STORY</div>
              <h3>
                Know a community
                <br />
                that needs a hand?
              </h3>
              <p>
                Submit a fictional relief campaign for manual review. Approval
                and payment readiness are checked separately.
              </p>
              <Link className="button secondary" href="/dashboard">
                Submit a demo campaign ↗
              </Link>
            </div>
            <span className="community-bottom">
              FOR FAMILIES & ORGANIZATIONS
            </span>
          </aside>
        </div>
        {campaigns.length === 0 && (
          <div className="empty-state">
            {unavailable
              ? "Campaigns are temporarily unavailable. Please check back after local setup."
              : "No approved campaigns yet. New applications appear here after review."}
          </div>
        )}
      </section>
      <section id="how-it-works" className="how-section">
        <div>
          <div className="eyebrow">LESS GUESSWORK. MORE CLARITY.</div>
          <h2>
            See where
            <br />
            your care <em>goes.</em>
          </h2>
          <p>
            Blockchain proves the wallet transfers. It does not prove that
            relief supplies were delivered.
          </p>
        </div>
        <ol className="flow-steps">
          <li>
            <span>01</span>
            <div>
              <h3>Choose a community</h3>
              <p>
                Read the fictional story and see the approved public recipient
                wallets.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Give with your approval</h3>
              <p>
                Sign in with Google, connect Freighter and review a fixed 1 XLM
                Testnet payment plus fees.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Follow the original payment</h3>
              <p>
                Your private receipt becomes verified only after finality and
                both exact payouts are checked.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="closing-note">
        <span>✳</span>
        <p>
          Help should have a clear path.
          <br />
          <em>We’re making that path visible.</em>
        </p>
        <Link href="#campaigns" className="button">
          Take the first step ↗
        </Link>
      </section>
    </main>
  );
}
