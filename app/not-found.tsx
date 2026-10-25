import Link from "next/link";
export default function NotFound() {
  return (
    <main className="narrow-page">
      <h1>A different path.</h1>
      <p>This record could not be found or is not available to your account.</p>
      <Link className="button" href="/">
        Back to AidFlow ↗
      </Link>
    </main>
  );
}
