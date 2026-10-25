"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserRequest } from "@/lib/browser-api";
export function AdminReview({
  id,
  isSeeded,
}: {
  id: string;
  isSeeded: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setMessage("");
        try {
          await browserRequest(`/api/admin/campaigns/${id}`, {
            decision: data.get("decision"),
            reason: data.get("reason"),
          });
          setMessage("Review decision saved and audited.");
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Could not save review.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label>
          Decision
          <select name="decision">
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approve application</option>
            <option value="NEEDS_CHANGES">Request changes</option>
            <option value="REJECTED">Reject application</option>
            {isSeeded && (
              <>
                <option value="ACTIVATE">Activate verified demo config</option>
                <option value="PAUSE">Pause new payments</option>
              </>
            )}
          </select>
        </label>
        <label>
          Private review reason
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            rows={2}
            placeholder="Record fictional consent, recipient-control and evidence review."
          />
        </label>
      </div>
      <button className="button secondary" disabled={busy}>
        {busy ? "Saving…" : "Save audited decision"}
      </button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
