"use client";
import { useEffect, useState } from "react";
import { readRecovery } from "@/lib/recovery";
import { browserRequest } from "@/lib/browser-api";
import { updateLegacyResult } from "@/lib/checkout-storage";
export function LegacyRecovery() {
  const [hash, setHash] = useState(""),
    [recordKey, setRecordKey] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("paiflow-sdk-payment-v2:")) {
          const record = readRecovery(
            key.slice("paiflow-sdk-payment-v2:".length),
            localStorage.getItem(key)!,
          );
          setHash(record.prepared.txHash);
          setRecordKey(key);
          break;
        }
      }
    } catch {
      setMessage(
        "Existing recovery could not be read. Preserve browser storage for operator review.",
      );
    }
  }, []);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const data = await browserRequest<{
            status: string;
            txHash: string;
            network: string;
          }>("/api/pay", { action: "status", txHash: hash });
          if (recordKey) updateLegacyResult(localStorage, recordKey, data);
          setMessage(
            `Original transaction status: ${data.status}. Matching final status is saved without deleting evidence. This does not create an AidFlow donation or verify payouts.`,
          );
        } catch {
          setMessage(
            "Original status unresolved. Keep all evidence and check again later.",
          );
        }
      }}
    >
      <label>
        Original public transaction hash
        <input
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          required
          pattern="[a-f0-9]{64}"
          maxLength={64}
        />
      </label>
      <button className="button">Check original transaction</button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
