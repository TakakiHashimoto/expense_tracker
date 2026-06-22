// This button syncs transactions

"use client";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Props = { plaidItemId: string };

function SyncInstitutionButton({ plaidItemId }: Props) {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const router = useRouter();

  async function syncTransactions() {
    try {
      setIsSyncing(true);
      const res = await fetch(`/api/plaid/sync-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_uuid: plaidItemId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "ITEM_LOGIN_REQUIRED") {
          toast.warning("Your bank connection needs to be updated.");
          router.refresh();
          return;
        }

        throw new Error(data.error ?? "Failed to synchronize bank");
      }

      toast.success(
        `Synced ${data.addedCount} new and ${data.modifiedCount} updated transactions`,
      );

      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to synchronize bank",
      );
    } finally {
      setIsSyncing(false);
    }
  }
  return (
    <button type="button" onClick={syncTransactions} disabled={isSyncing}>
      <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
      {isSyncing ? "Synchronizing" : "Retry synchronization"}
    </button>
  );
}

export default SyncInstitutionButton;
