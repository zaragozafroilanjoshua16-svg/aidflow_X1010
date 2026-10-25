import Link from "next/link";
import type { Campaign } from "@/lib/campaigns";
import { xlm, progress } from "@/lib/display";
import { CampaignArt } from "./campaign-art";
export function CampaignCard({ campaign: c }: { campaign: Campaign }) {
  return (
    <article className="campaign-card">
      <Link
        href={`/campaigns/${c.slug}`}
        className="card-art-link"
        tabIndex={-1}
        aria-hidden="true"
      >
        <CampaignArt compact />
      </Link>
      <div className="card-body">
        <div className="eyebrow">
          PHILIPPINES <span>·</span> FICTIONAL DEMO
        </div>
        <h3>
          <Link href={`/campaigns/${c.slug}`}>{c.title}</Link>
        </h3>
        <p>
          Restore a sense of home, one essential at a time. A transparent
          Testnet relief demonstration.
        </p>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Verified XLM progress"
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
          <strong>
            {xlm(c.verified_stroops)} XLM <span>verified</span>
          </strong>
          <span>of {xlm(c.xlm_goal_stroops)} XLM</span>
        </div>
        <div className="card-foot">
          <span className="status-pill">
            {c.fundraising_status === "ACTIVE"
              ? "Testnet checkout active"
              : c.fundraising_status.replaceAll("_", " ").toLowerCase()}
          </span>
          <Link href={`/campaigns/${c.slug}`} className="text-link">
            View campaign ↗
          </Link>
        </div>
      </div>
    </article>
  );
}
