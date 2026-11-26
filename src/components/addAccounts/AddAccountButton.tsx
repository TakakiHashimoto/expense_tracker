"use client";

import { useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";
import Spinner from "../common/Spinner";

type Props = { plaidItemUuid: string | null };

type AddAccountStatus =
  | "idle"
  | "preparing_link"
  | "adding_account"
  | "syncing";

function AddAccountButton({ plaidItemUuid }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [status, setStatus] = useState<AddAccountStatus>("idle");
  const [recovery, setRecovery] = useState<"dashboard" | "repair" | null>(null);
  // State disables the UI; the ref also guards clicks before React re-renders.
  const requestStage = useRef<"idle" | "link" | "sync">("idle");

  const router = useRouter();

  async function obtainLinkToken() {
    requestStage.current = "link";
    try {
      setStatus("preparing_link");
      const res = await fetch("/api/plaid/add-account", {
        method: "POST",
        body: JSON.stringify({ plaidItemUuid: plaidItemUuid }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        setFrontError(data.error ?? "Failed to obtain link token");
        toast.error("Failed to obtain link token");
        setStatus("idle");
        requestStage.current = "idle";
        return;
      }

      setLinkToken(data.link_token);
      setStatus("adding_account");
    } catch (e) {
      console.error("Failed to obtain link token", e);
      setFrontError("Failed to obtain link token");
      setStatus("idle");
      requestStage.current = "idle";
    }
  }

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async () => {
      if (requestStage.current === "sync") return;
      requestStage.current = "sync";
      try {
        setFrontError(null);
        setStatus("syncing");
        const res = await fetch("/api/plaid/refresh-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaidItemUuid }),
        });
        const data = await res.json();
        const accountsSucceeded =
          data.accountRefreshSucceeded === true &&
          data.accountRefreshStatus === "succeeded";
        if (accountsSucceeded || data.error === "ITEM_LOGIN_REQUIRED") {
          // Reflect committed balances and the existing connection repair control.
          router.refresh();
        }

        if (res.ok && accountsSucceeded && data.transactionSyncStatus === "synced") {
          toast.success(
            `${data.addedCount} added, ${data.removedCount} removed, ${data.modifiedCount} modified`,
          );
          return;
        }

        let message: string;
        if (data.accountRefreshStatus === "unconfirmed") {
          setRecovery("dashboard");
          message = "Account refresh outcome is unconfirmed. Check your dashboard before trying again.";
        } else if (data.transactionSyncStatus === "unconfirmed" || data.error === "TRANSACTION_SYNC_OUTCOME_UNCONFIRMED") {
          setRecovery("dashboard");
          message = `${accountsSucceeded ? "Accounts were updated, but the transaction" : "Transaction"} sync outcome is unconfirmed. Check your dashboard.`;
        } else if (data.error === "ITEM_LOGIN_REQUIRED") {
          setRecovery("repair");
          message = `${accountsSucceeded ? "Accounts were updated. " : ""}Your bank connection needs attention. Use Update bank connection on the Accounts page.`;
        } else if (data.error === "SYNC_BUSY" || data.transactionSyncStatus === "busy") {
          message = "A sync is already in progress. Check your dashboard shortly.";
        } else if (data.error === "SYNC_SUPERSEDED") {
          message = `${accountsSucceeded ? "Accounts were updated. " : ""}This sync was superseded. Check your dashboard for the latest state.`;
        } else if (accountsSucceeded) {
          message = "Accounts were updated, but transaction sync did not complete. Check your dashboard.";
        } else if (data.accountRefreshStatus === "not_completed" && data.accountRefreshSucceeded === false) {
          message = "Accounts could not be refreshed. Please check your bank connection.";
        } else {
          setRecovery("dashboard");
          message = "Account refresh outcome is unconfirmed. Check your dashboard before trying again.";
        }
        setFrontError(message);
        toast.info(message);
      } catch {
        setRecovery("dashboard");
        const message = "Account refresh outcome is unconfirmed. Check your dashboard before trying again.";
        setFrontError(message);
        toast.info(message);
      } finally {
        setStatus("idle");
        setLinkToken(null);
        requestStage.current = "idle";
      }
    },
    onExit: (err) => {
      if (requestStage.current === "sync") return;
      if (err) {
        console.error(err);
        setFrontError("Something went wrong while opening your account modal");
      }
      setStatus("idle");
      setLinkToken(null);
      requestStage.current = "idle";
    },
  });

  const disabled = status !== "idle" || !!frontError || !!error || recovery !== null;

  function handleClick() {
    if (disabled || requestStage.current !== "idle") return;
    if (!plaidItemUuid) {
      toast.error("Select an institution first", {
        className:
          "!bg-tertiary !text-on-tertiary border-tertiary !shadow-lg !text-lg",
      });
      return;
    }

    obtainLinkToken();
  }

  useEffect(() => {
    if (linkToken && ready && status === "adding_account") {
      open();
    }
  }, [open, ready, linkToken, status]);

  return (
    <div>
      {(frontError || error) && (
        <div className="rounded-xl bg-tertiary border border-tertiary/30 p-4 text-sm text-on-tertiary absolute top-13" role="status">
          <p className="font-semibold">Account refresh</p>
          <p>{frontError ?? "Bank link could not load. Check your dashboard and reload this page before trying again."}</p>
          {recovery || error ? (
            <button
              type="button"
              className="underline"
              onClick={() => router.push(recovery === "repair" ? "/accounts" : "/dashboard")}
            >
              {recovery === "repair" ? "Review bank connection" : "Check dashboard"}
            </button>
          ) : (
            <button type="button" className="underline" onClick={() => setFrontError(null)}>
              Dismiss
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2 items-center">
        {status !== "idle" && <Spinner />}
        <button
          className={disabled ? "btn-secondary my-3 cursor-not-allowed" : "btn-primary my-3"}
          onClick={handleClick}
          disabled={disabled}
        >
          {status === "preparing_link" ? "Preparing Link..."
            : status === "adding_account" ? "Adding Account..."
              : status === "syncing" ? "Syncing..." : "Add Account"}
        </button>
      </div>
    </div>
  );
}

export default AddAccountButton;
