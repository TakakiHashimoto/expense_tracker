"use client";

import Spinner from "@/components/common/Spinner";
import { RefreshCw, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";

type SyncStatus =
  | "idle"
  | "syncing"
  | "success"
  | "error"
  | "needs_repair"
  | "creating_update_link_token"
  | "ready_to_repair";

function SyncDashboardButton() {
  const [updateLinkToken, setUpdateLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [, setMessage] = useState<string | null>(null);
  const [repairPlaidItemId, setRepairPlaidItemId] = useState<string | null>(
    null,
  );

  const router = useRouter();

  function showMessage(
    nextMessage: string,
    type: "success" | "error" | "info" | "warning" = "info",
  ) {
    setMessage(nextMessage);
    toast[type](nextMessage);
  }

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
          showMessage(
            data.message ?? "Your bank connection needs to be updated.",
            "warning",
          );
          return;
        }
        throw new Error(data.error ?? "Failed to sync");
      }

      setStatus("success");
      showMessage(
        `Synced ${data.addedCount} new, ${data.modifiedCount} updated`,
        "success",
      );
      router.refresh();
    } catch (e) {
      setStatus("error");
      showMessage(
        e instanceof Error ? e.message : "Something went wrong while syncing",
        "error",
      );
    }
  }

  async function handleUpdateLinkToken() {
    try {
      if (!repairPlaidItemId) {
        throw new Error("Missing Plaid item id for repair");
      }

      setStatus("creating_update_link_token");
      setMessage(null);
      const res = await fetch("/api/plaid/update-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_uuid: repairPlaidItemId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create update link token");
      }

      if (!data.link_token) {
        throw new Error("Update link token was not returned");
      }

      setUpdateLinkToken(data.link_token);
      showMessage(
        "Update link token created. Ready to open Plaid Link.",
        "success",
      );
      setStatus("ready_to_repair");
    } catch (e) {
      console.error("Failed to create update link token", e);
      setStatus("needs_repair");
      showMessage(
        e instanceof Error
          ? e.message
          : "Something went wrong while preparing bank repair",
        "error",
      );
    }
  }

  const { open, ready } = usePlaidLink({
    token: updateLinkToken,
    onSuccess: async () => {
      showMessage("Bank connection updated. Syncing transactions...", "info");
      await handleSync();
    },
    onExit: () => {
      setStatus("needs_repair");
      showMessage(
        "Bank update was cancelled. Your connection still needs repair.",
        "warning",
      );
    },
  });

  function handleOpenPlaidUpdate() {
    if (!updateLinkToken) {
      showMessage("Missing update link token. Please try again.", "error");
      setStatus("needs_repair");
      return;
    }

    if (!ready) {
      showMessage(
        "Plaid Link is still loading. Please try again in a moment.",
        "info",
      );
      return;
    }

    open();
  }

  function handleRepairClick() {
    if (status === "ready_to_repair") {
      handleOpenPlaidUpdate();
      return;
    }

    handleUpdateLinkToken();
  }

  const isSyncing = status === "syncing";

  const isUpdatingLinkToken = status === "creating_update_link_token";

  return (
    <div className="flex min-w-64 flex-col items-end gap-2">
      {status !== "needs_repair" && (
        <button
          className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-extrabold tracking-wide text-on-primary shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/30 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
          onClick={handleSync}
          disabled={
            isSyncing ||
            status === "creating_update_link_token" ||
            status === "ready_to_repair"
          }
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? (
            <div>
              <Spinner />
              "Syncing..."
            </div>
          ) : (
            "Sync bank"
          )}
        </button>
      )}
      {(status === "needs_repair" ||
        status === "creating_update_link_token" ||
        status === "ready_to_repair") &&
        repairPlaidItemId && (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 text-xs font-bold text-primary transition-colors hover:border-primary/45 hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-60"
            onClick={handleRepairClick}
            disabled={isUpdatingLinkToken}
          >
            <Wrench className="h-3.5 w-3.5" />
            {status === "creating_update_link_token"
              ? "Preparing update link token"
              : status === "ready_to_repair"
                ? "Open Plaid update"
                : "Update bank connection"}
          </button>
        )}
    </div>
  );
}

export default SyncDashboardButton;
