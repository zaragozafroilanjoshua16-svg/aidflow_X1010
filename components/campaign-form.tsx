"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserRequest } from "@/lib/browser-api";
export function CampaignForm() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="application-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget,
          data = new FormData(form);
        setBusy(true);
        setMessage("");
        try {
          await browserRequest("/api/campaigns", {
            title: data.get("title"),
            description: data.get("description"),
            disasterType: data.get("disasterType"),
            region: data.get("region"),
            beneficiaryType: data.get("beneficiaryType"),
            consent: data.get("consent") === "on",
          });
          form.reset();
          setMessage(
            "Submitted for manual review. Payments remain disabled until separately verified.",
          );
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Submission could not be saved.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Campaign title
        <input
          name="title"
          required
          minLength={6}
          maxLength={120}
          placeholder="A fictional community and a new beginning"
        />
      </label>
      <div className="form-grid">
        <label>
          Beneficiary type
          <select name="beneficiaryType">
            <option value="FAMILY">Individual / family</option>
            <option value="ORGANIZATION">Organization</option>
          </select>
        </label>
        <label>
          Disaster type
          <select name="disasterType">
            <option value="typhoon">Typhoon</option>
            <option value="flood">Flood</option>
            <option value="earthquake">Earthquake</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>
      <label>
        Region in the Philippines
        <input
          name="region"
          required
          minLength={2}
          maxLength={120}
          placeholder="e.g. Eastern Visayas"
        />
      </label>
      <label>
        Fictional story and evidence summary
        <textarea
          name="description"
          rows={5}
          minLength={30}
          maxLength={8000}
          required
          placeholder="Describe the fictional need, intended relief and synthetic consent evidence. Do not include real IDs or sensitive beneficiary data."
        />
      </label>
      <label className="consent">
        <input name="consent" type="checkbox" required />
        <span>
          I confirm this is a fictional demo application with synthetic
          beneficiary consent and recipient-control evidence. No real personal
          documents are included.
        </span>
      </label>
      <p className="fine-print">
        Private file uploads are deferred. Approval does not activate checkout
        or perform real-world KYC.
      </p>
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Submit for review ↗"}
      </button>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </form>
  );
}
