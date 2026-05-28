"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncStatus = "idle" | "syncing" | "success" | "error" | "needs_repair";

function SyncDashboardButton() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [repairPlaidItemId, setRepairPlaidItemId] = useState<string | null>(
    null,
  );

  const router = useRouter();

  async function handleSync() {
    try {
      setStatus("syncing");
      setMessage(null);
      const res = await fetch("/api/plaid/sync-all", { method: "POST" });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "ITEM_LOGIN_REQUIRED") {
          setStatus("needs_repair");
          setRepairPlaidItemId(data.plaidItemId ?? null);
          setMessage(
            data.message ?? "Your bank connection needs to be updated.",
          );
          return;
        }
        throw new Error(data.error ?? "Failed to sync");
      }

      setStatus("success");
      setMessage(
        `Synced ${data.addedCount} new, ${data.modifiedCount} updated`,
      );
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMessage(
        e instanceof Error ? e.message : "Something went wrong while syncing",
      );
    }
  }

  const isSyncing = status === "syncing";

  return (
    <div>
      <button
        className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide active:scale-[0.98] transition-transform shadow-lg shadow-primary/20 cursor-pointer"
        onClick={handleSync}
        disabled={isSyncing}
      >
        {isSyncing ? "Syncing..." : "Sync bank"}
      </button>

      {message && (
        <p
          className={`text-xs ${
            status === "error" || status === "needs_repair"
              ? "text-tertiary"
              : "text-primary"
          }`}
        >
          {message}
        </p>
      )}

      {status === "needs_repair" && repairPlaidItemId && (
        <button
          type="button"
          className="mt-2 text-xs font-bold text-primary underline underline-offset-4"
          onClick={}
        >
          Update bank connection
        </button>
      )}
    </div>
  );
}

export default SyncDashboardButton;
