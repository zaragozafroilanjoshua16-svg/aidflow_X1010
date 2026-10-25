"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="narrow-page">
      <div className="eyebrow">LET’S KEEP THE ORIGINAL RECORD SAFE</div>
      <h1>A brief interruption.</h1>
      <p>
        This page is temporarily unavailable. Existing payment evidence is
        retained. Try loading again or return to your dashboard; do not create a
        replacement payment.
      </p>
      <button className="button" onClick={reset}>
        Try loading again
      </button>
    </main>
  );
}
