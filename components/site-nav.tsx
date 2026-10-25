import Link from "next/link";
import { currentUser } from "@/lib/identity";
import { signOut } from "@/auth";
export async function SiteNav() {
  let user = null;
  try {
    user = await currentUser();
  } catch {}
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="AidFlow home">
        <span className="brand-mark" aria-hidden="true">
          ✳
        </span>
        AidFlow<span className="brand-dot">.</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#campaigns">Explore campaigns</Link>
        <Link href="/#how-it-works">How it works</Link>
        {user && <Link href="/dashboard">My dashboard</Link>}
        {user?.role === "ADMIN" && <Link href="/admin">Admin</Link>}
      </nav>
      <div className="nav-actions">
        <span className="network-label">
          <i />
          Stellar Testnet
        </span>
        {user ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="button small secondary">Sign out</button>
          </form>
        ) : (
          <Link className="button small" href="/signin">
            Sign in <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Link href="/" className="brand">
          AidFlow.
        </Link>
        <p>Small acts. A clearer path to relief.</p>
      </div>
      <p>
        A fictional disaster-relief prototype.
        <br />
        Valueless XLM on Stellar Testnet. No real donations.
      </p>
      <Link href="/#how-it-works">Built for transparency ↗</Link>
    </footer>
  );
}
