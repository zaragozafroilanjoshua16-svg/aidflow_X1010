import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/identity";
import { campaignBySlug } from "@/lib/campaigns";
import { DonationCheckout } from "@/components/donation-checkout";
export const dynamic = "force-dynamic";
export default async function DonatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    user = await currentUser();
  if (!user)
    redirect(
      `/signin?callbackUrl=${encodeURIComponent(`/campaigns/${slug}/donate`)}`,
    );
  const c = await campaignBySlug(slug);
  if (!c) notFound();
  return (
    <main className="detail-page">
      <Link className="back-link" href={`/campaigns/${slug}`}>
        ← Back to the campaign
      </Link>
      <div className="page-heading">
        <div className="eyebrow">A SMALL ACT, A CLEAR PATH</div>
        <h1>
          Your care starts <em>here.</em>
        </h1>
        <p>
          DEMO / TESTNET · No real funds or relief delivery are represented.
        </p>
      </div>
      {c.fundraising_status !== "ACTIVE" || !c.ready ? (
        <div className="notice">
          This campaign is not accepting new payments. Recover existing orders
          from your dashboard.
        </div>
      ) : (
        <DonationCheckout
          userId={user.id}
          campaign={{
            id: c.id,
            title: c.title,
            slug: c.slug,
            reliefAddress: c.relief_address!,
            logisticsAddress: c.logistics_address!,
          }}
        />
      )}
    </main>
  );
}
