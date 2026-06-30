"use client";

// 1. user clicks the button => generate link_token
// 2. with this link_token, opens the update portal
// 3. onSuccess, sync accounts to my database
// 4. refresh the page (/accounts, /dashboard)

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";

type Props = { plaidItemUuid: string | null };

type AddAccountStatus =
  | "idle"
  | "preparing_link"
  | "adding_account"
  | "syncing";

function AddAccountButton({ plaidItemUuid }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(plaidItemUuid);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [status, setStatus] = useState<AddAccountStatus>("idle");

  const disabled = status !== "idle";

  async function obtainLinkToken() {
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
        return;
      }

      setLinkToken(data.link_token);
    } catch (e) {
      setFrontError("Failed to obtain link token");
      setStatus("idle");
    }
  }

  // useEffect(() => {
  //   obtainLinkToken();
  // }, []);

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async () => {
      try {
        setStatus("syncing");
        const res = await fetch("../api/plaid/sync-all");
        const data = await res.json();
        if (!res.ok) {
          setFrontError("Failed to sync your account");
          toast.error("Failed to sync your account");
          return;
        }

        toast.success(
          `${data.addedCount} added, ${data.removedCount} removed, ${data.modifiedCount} modified`,
        );
        setStatus("idle");
      } catch (e) {
        setFrontError("Failed to sync your bank account");
        setStatus("idle");
      }
    },
    onExit: (err, metadata) => {
      console.error(err);
      if (err) {
        setFrontError("Something went wrong while opening your account modal");
        return;
      }
      return;
    },
  });

  function handleClick() {
    if (!plaidItemUuid) {
      toast.error("Select an institution first");
      return;
    }

    obtainLinkToken();
  }

  return (
    <div>
      <button
        className="btn-primary my-3"
        onClick={handleClick}
        disabled={disabled}
      >
        Add Account
      </button>
    </div>
  );
}

export default AddAccountButton;
