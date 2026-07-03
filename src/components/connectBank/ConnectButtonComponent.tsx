"use client";

import { Landmark } from "lucide-react";
import Spinner from "../common/Spinner";
import { usePlaidLink } from "react-plaid-link";
import getErrorMessage from "@/lib/formatError";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ConnectStatus =
  | "loading_link_token"
  | "ready"
  | "opening_plaid"
  | "exchanging"
  | "syncing"
  | "success"
  | "connect_error"
  | "sync_error";

function ConnectButtonComponent({ title }: { title: string }) {
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

  useEffect(() => {
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
    linkTokenRequest();
  }, []);

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? "",

    onExit: (err, metadata) => {
      console.log("Plaid Link exited", { err, metadata });

      if (err) {
        console.error("Exiting open link failed", err);
        setStatus("connect_error");
        setFrontError("Bank connection was closed before completion.");
        return;
      }

      setStatus("ready");
      setFrontError(null);
    },

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
        setStatus("success");
        router.push("/dashboard");
        router.refresh();
      } catch (e) {
        // if above failed, what should I do?
        console.error("Transaction sync failed", e);
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
        console.error(`Retry Sync failed: ${errorBody}`);
        throw new Error(
          "Transaction Sync failed again. Please re-try in a moment",
        );
      }

      const syncResult = await syncRes.json();
      setStatus("success");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      // if above failed, what should I do?
      console.error(`Plaid connect flow failed: ${e}`);
      setStatus("sync_error");
      setFrontError(
        e instanceof Error ? e.message : "syncing transaction failed again.",
      );
    }
  }
  return (
    <div className="flex flex-col gap-6 relative shadow-lg rounded-2xl">
      <button
        className="btn-primary shadow-lg"
        onClick={handleClick}
        disabled={!ready || isBusy}
      >
        {isBusy && <Spinner />}
        {status === "loading_link_token" && "Preparing connection..."}
        {status === "opening_plaid" && "Opening Plaid..."}
        {status === "exchanging" && "Connecting bank..."}
        {status === "syncing" && "Syncing transactions..."}

        {!isBusy && `${title}`}

        {!isBusy && <Landmark />}
      </button>
      {frontError && (
        <div className="rounded-xl bg-tertiary border border-tertiary/30 p-4 text-sm text-on-tertiary absolute top-13 ">
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
    </div>
  );
}

export default ConnectButtonComponent;
