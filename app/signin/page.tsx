import Link from "next/link";
import { signIn, authReady } from "@/auth";
import { safeRedirect } from "@/lib/identity-policy";
export const dynamic = "force-dynamic";
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const destination = safeRedirect(
    params.callbackUrl || "/dashboard",
    process.env.AIDFLOW_PUBLIC_ORIGIN || "http://localhost:3000",
  );
  return (
    <main className="narrow-page">
      <div className="eyebrow">YOUR NEXT SMALL ACT</div>
      <h1>
        Welcome to
        <br />
        <em>the flow.</em>
      </h1>
      <p>
        Sign in to submit a fictional campaign, authorize Testnet donations and
        return to your original payment receipts.
      </p>
      <section className="panel signin-panel">
        <span className="large-symbol">✳</span>
        <h2>Continue with Google</h2>
        <p>Your wallet stays yours. AidFlow never asks for its secret key.</p>
        {params.error && (
          <p role="alert">
            Sign-in could not be completed. Check your account access and try
            again.
          </p>
        )}
        {authReady() ? (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: destination });
            }}
          >
            <button className="button full">
              Sign in with Google <span>↗</span>
            </button>
          </form>
        ) : (
          <div className="notice">
            Google sign-in is awaiting local setup. Campaign browsing is
            available; donations and submissions stay locked until sign-in
            works.
          </div>
        )}
        <p className="fine-print">
          Google only · No passwords · No guest checkout
        </p>
      </section>
      <Link className="text-link" href="/">
        ← Explore the demo
      </Link>
    </main>
  );
}
