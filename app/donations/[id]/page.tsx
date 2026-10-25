import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/identity";
import { getOrder } from "@/lib/orders";
import { DonationCheckout } from "@/components/donation-checkout";
export const dynamic = "force-dynamic";
export default async function DonationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    user = await currentUser();
  if (!user)
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/donations/${id}`)}`);
  let order;
  try {
    order = await getOrder(user, id);
  } catch {
    notFound();
  }
  return (
    <main className="detail-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR PRIVATE PAYMENT RECORD</div>
        <h1>
          Every act has <em>a trail.</em>
        </h1>
        <p>
          DEMO / TESTNET · Original order and independently verified transfer
          evidence.
        </p>
      </div>
      <DonationCheckout
        userId={user.id}
        initialOrder={order}
        campaign={{
          id: order.campaignId,
          title: order.title,
          slug: order.slug,
          reliefAddress: order.reliefAddress,
          logisticsAddress: order.logisticsAddress,
        }}
      />
    </main>
  );
}
