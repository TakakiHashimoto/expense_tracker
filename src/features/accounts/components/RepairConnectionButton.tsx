// This button is for updating user's plaid item
// 1. first click prepares update-link-token for plaid modal
// 2. second click opens plaid modal
// 3. once user update is successfull, sync new changes to my db

"use client";
import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";

type Props = { repairPlaidItemId: string };

type SyncStatus = "idle" | "creating_token" | "syncing" | "error" | "ready";

function RepairConnectionButton({ repairPlaidItemId }: Props) {
  const [updateLinkToken, setUpdateLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");

  const router = useRouter();

  async function createUpdateToken() {
    try {
      if (!repairPlaidItemId) {
        throw new Error("Missing Plaid item id for repair");
      }
      setStatus("creating_token");
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

      setStatus("ready");
    } catch (e) {
      console.error("Failed to create update link token", e);
      setStatus("error");
      toast.error(
        e instanceof Error ? e.message : "Failed to prepare bank update",
      );
    }
  }

  async function syncRepairedItem() {
    setStatus("syncing");

    const response = await fetch("/api/plaid/sync-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plaid_item_uuid: repairPlaidItemId }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message ?? data.error ?? "Failed to sync bank");
    }

    toast.success("Bank connection updated");
    router.refresh();
  }

  const { open, ready } = usePlaidLink({
    token: updateLinkToken,
    onSuccess: async () => {
      try {
        toast.info("Connection updated. Synchronizing...");
        await syncRepairedItem();
      } catch (e) {
        setStatus("error");
        toast.error(
          e instanceof Error
            ? e.message
            : "Connection updated, but synchronization failed",
        );
      }
    },
    onExit: () => {
      setStatus("idle");
      setUpdateLinkToken(null);
    },
  });

  function handleRepairClick() {
    // if update-link is not ready
    if (status !== "ready") {
      createUpdateToken();
      return;
    }

    if (!updateLinkToken || !ready) {
      toast.info("Plaid Link is still loading");
      return;
    }

    open();
  }

  return (
    <div className="flex min-w-64 flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleRepairClick}
        disabled={status === "creating_token" || status === "syncing"}
      >
        <Wrench className="h-4 w-4" />

        {status === "creating_token"
          ? "Preparing update"
          : status === "ready"
            ? "Open bank update"
            : status === "syncing"
              ? "Synchronizing"
              : "Update bank connection"}
      </button>
    </div>
  );
}

export default RepairConnectionButton;
