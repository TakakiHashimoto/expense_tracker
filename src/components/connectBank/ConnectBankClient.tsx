// This is the redirect target where users are redirected to after clicking "Get Started"
// Means this page will have button and actual bank connect logic will take place

// 1. user click "connect bank"
// 2. request link token
// 3. open link
// 4. get public token
// 5. exchagne the puclic token with access token
// 6. sync the bank transaction with database

"use client";

import Spinner from "@/components/common/Spinner";
import getErrorMessage from "@/lib/formatError";
import { EyeOff, Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type ConnectStatus =
  | "loading_link_token"
  | "ready"
  | "opening_plaid"
  | "exchanging"
  | "syncing"
  | "success"
  | "connect_error"
  | "sync_error";

export default function ConnectBank() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectStatus>("loading_link_token");
  const [frontError, setFrontError] = useState<string | null>(null);
  const [plaidItemUuid, setPlaidItemUuid] = useState<string | null>(null);

  const isBusy =
    status === "loading_link_token" ||
    status === "opening_plaid" ||
    status === "exchanging" ||
    status === "syncing";

  const router = useRouter();

  async function linkTokenRequest() {
    try {
      // set the status first
      setStatus("loading_link_token");
      setFrontError(null);

      const res = await fetch(`/api/plaid/link-token`, { method: "POST" });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(getErrorMessage(data, "Failed to get link_token"));
      }

      const { link_token } = data;
      if (!link_token) {
        throw new Error("Bank connection setup failed. Try again.");
      }

      setLinkToken(link_token);
      setStatus("ready");
    } catch (e) {
      console.error("Failed to request Plaid link token", e);
      setStatus("connect_error");
      setFrontError(
        e instanceof Error
          ? e.message
          : "Could not start bank connection. Please try again",
      );
    }
  }

  useEffect(() => {
    linkTokenRequest();
  }, []);

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? "",

    onSuccess: async (public_token, metadata) => {
      // send public_token to a server
      const passData = { public_token, metadata };
      let connectedPlaidUuid: string | null = null;

      // change the public token to access token request for server
      try {
        setFrontError(null);
        setStatus("exchanging");
        // connecting bank phase
        const res = await fetch(`/api/plaid/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(passData),
        });

        if (res.status === 409) {
          router.push("/dashboard");
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            getErrorMessage(data, "Failed to exchange access-token"),
          );
        }

        const { plaid_item_uuid } = data; // This is plaid_items internal DB id
        if (!plaid_item_uuid) {
          throw new Error("plaid item uuid not found");
        }

        connectedPlaidUuid = plaid_item_uuid;

        // exchanging public_token with access_teken is done here and move onto syncing part
        setPlaidItemUuid(plaid_item_uuid);
      } catch (e) {
        console.error("Bank exchange failed: ", e);
        setStatus("connect_error");
        setFrontError(
          e instanceof Error
            ? e.message
            : "Failed to connect your bank. Please try again",
        );
        return;
      }

      // syncing bank phase
      try {
        setStatus("syncing");
        const syncRes = await fetch(`/api/plaid/sync-transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaid_item_uuid: connectedPlaidUuid }),
        });

        if (!syncRes.ok) {
          const errorBody = await syncRes.json().catch(() => null);
          console.error(`Sync failed: ${errorBody}`);
          throw new Error(
            "Your bank was successfully connected, but syncing transaction failed.",
          );
        }

        const syncResult = await syncRes.json();
        console.log(syncResult);
        setStatus("success");
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        // if above failed, what should I do?
        console.log("Transaction sync failed", e);
        setStatus("sync_error");
        setFrontError(
          e instanceof Error
            ? e.message
            : "Your bank was successfully connected, but syncing transaction failed.",
        );
      }
    },
  });

  // This is for opening the plaid modal
  function handleClick() {
    if (!ready) return;
    setFrontError(null);
    setStatus("opening_plaid");
    open();
  }

  async function retrySync() {
    if (!plaidItemUuid) {
      setStatus("connect_error");
      setFrontError("Bank connect id is missing. Connect your bank again");
      return;
    }

    try {
      setStatus("syncing");
      const syncRes = await fetch(`/api/plaid/sync-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_uuid: plaidItemUuid }),
      });

      if (!syncRes.ok) {
        const errorBody = await syncRes.json().catch(() => null);
        console.log(`Retry Sync failed: ${errorBody}`);
        throw new Error(
          "Transaction Sync failed again. Please re-try in a moment",
        );
      }

      const syncResult = await syncRes.json();
      console.log(syncResult);
      setStatus("success");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      // if above failed, what should I do?
      console.log(`Plaid connect flow failed: ${e}`);
      setStatus("sync_error");
      setFrontError(
        e instanceof Error ? e.message : "syncing transaction failed again.",
      );
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      <section className="space-y-10">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight text-on-surface">
            Connect your <br />
            <span className="text-primary-fixed-dim">Bank Account</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-lg leading-relaxed font-medium">
            Securely connect your account to automatically sync transactions and
            start tracking your spending with editorial precision.
          </p>
        </div>
        <div className="flex flex-col gap-6">
          <button
            className="w-fit bg-linear-to-r from-primary to-primary-container text-on-primary px-10 py-5 rounded-xl font-bold text-lg active:scale-95 transition-transform shadow-[0_0_20px_rgba(78,222,163,0.15)] flex items-center gap-3 cursor-pointer"
            onClick={handleClick}
            disabled={!ready || isBusy}
          >
            {isBusy && <Spinner />}
            {status === "loading_link_token" && "Preparing connection..."}
            {status === "opening_plaid" && "Opening Plaid..."}
            {status === "exchanging" && "Connecting bank..."}
            {status === "syncing" && "Syncing transactions..."}

            {!isBusy && "Connect Bank"}

            {!isBusy && <Landmark />}
          </button>
          {frontError && (
            <div className="rounded-xl bg-tertiary/15 border border-tertiary/30 p-4 text-sm text-tertiary">
              <p className="font-semibold">Something went wrong</p>
              <p>{frontError}</p>
            </div>
          )}

          {status === "sync_error" && plaidItemUuid && (
            <button
              type="button"
              onClick={retrySync}
              className="w-fit rounded-xl border border-primary/40 px-6 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
            >
              Retry transaction sync
            </button>
          )}

          <div className="flex items-center gap-3 py-2 px-4 bg-surface-container-low rounded-lg w-fit">
            <span
              className="material-symbols-outlined text-primary text-sm"
              data-icon="verified_user"
            >
              verified_user
            </span>
            <p className="text-[13px] text-on-surface-variant font-medium">
              Powered by Plaid. Your banking credentials are never stored by
              this app.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <LockKeyhole className="material-symbols-outlined text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Secure connection
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <EyeOff className="material-symbols-outlined text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Read-only access
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <ShieldCheck className="material-symbols-outlined text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Private by design
            </span>
          </div>
        </div>

        {
          error && <p>Error</p>
          // I will show real error message later
        }
      </section>
    </div>
  );
}
