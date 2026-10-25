import { redirect } from "next/navigation";
import { currentUser } from "@/lib/identity";
import { LegacyRecovery } from "@/components/legacy-recovery";
export const dynamic = "force-dynamic";
export default async function Recover() {
  if (!(await currentUser()))
    redirect("/signin?callbackUrl=%2Fstarter%2Frecover");
  return (
    <main className="narrow-page">
      <h1>
        Check the original
        <br />
        <em>starter payment.</em>
      </h1>
      <p>
        This read-only recovery preserves browser evidence. Raw starter
        preparation and submission are retired; new payments require an AidFlow
        order.
      </p>
      <section className="panel">
        <LegacyRecovery />
      </section>
    </main>
  );
}
