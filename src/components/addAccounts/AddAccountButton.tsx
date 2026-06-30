"use client";

import { useRouter } from "next/navigation";
// 1. user clicks the button => generate link_token
// 2. with this link_token, opens the update portal
// 3. onSuccess, sync accounts to my database
// 4. refresh the page (/accounts, /dashboard)

import { useEffect, useState } from "react";
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

  const router = useRouter();

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
        setStatus("idle");
        return;
      }

      setLinkToken(data.link_token);
      setStatus("adding_account");
    } catch (e) {
      setFrontError("Failed to obtain link token");
      setStatus("idle");
    }
  }

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async () => {
      try {
        setStatus("syncing");
        const res = await fetch("/api/plaid/refresh-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaidItemUuid }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFrontError("Failed to sync your account");
          toast.error("Failed to sync your account");
          setStatus("idle");
          return;
        }

        toast.success(
          `${data.addedCount} added, ${data.removedCount} removed, ${data.modifiedCount} modified`,
        );
        setStatus("idle");
        setLinkToken(null);
        router.refresh();
      } catch (e) {
        setFrontError("Failed to sync your bank account");
        setStatus("idle");
      }
    },
    onExit: (err, metadata) => {
      console.error(err);
      if (err) {
        setFrontError("Something went wrong while opening your account modal");
      }
      setStatus("idle");
    },
  });

  function handleClick() {
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

  if (frontError || error) {
    return (
      <div className="rounded-xl bg-tertiary border border-tertiary/30 p-4 text-sm text-on-tertiary absolute top-13 ">
        <p className="font-semibold">Something went wrong</p>
        <p>{frontError}</p>
      </div>
    );
  }

  if (status === "preparing_link") {
    return (
      <div className="flex gap-2 items-center">
        <Spinner />
        <button
          className={
            disabled
              ? "btn-secondary my-3 cursor-not-allowed"
              : "btn-primary my-3"
          }
          onClick={handleClick}
          disabled={disabled}
        >
          Preparing Link...
        </button>
      </div>
    );
  }

  if (status === "adding_account") {
    return (
      <div className="flex gap-2 items-center">
        <Spinner />
        <button
          className={
            disabled
              ? "btn-secondary my-3 cursor-not-allowed"
              : "btn-primary my-3"
          }
          onClick={handleClick}
          disabled={disabled}
        >
          Adding Account...
        </button>
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="flex gap-2 items-center">
        <Spinner />
        <button
          className={
            disabled
              ? "btn-secondary my-3 cursor-not-allowed"
              : "btn-primary my-3"
          }
          onClick={handleClick}
          disabled={disabled}
        >
          Syncing...
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        className={
          disabled
            ? "btn-secondary my-3 cursor-not-allowed"
            : "btn-primary my-3"
        }
        onClick={handleClick}
        disabled={disabled}
      >
        Add Account
      </button>
    </div>
  );
}

export default AddAccountButton;
