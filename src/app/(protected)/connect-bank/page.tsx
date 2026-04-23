// This is the redirect target where users are redirected to after clicking "Get Started"
// Means this page will have button and actual bank connect logic will take place

"use client";

import { EyeOff, Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectBank() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const router = useRouter();

  async function linkTokenRequest() {
    const res = await fetch(`/api/plaid/link-token`, { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to get link_token");
    }

    const { link_token } = await res.json();
    setLinkToken(link_token);
  }

  useEffect(() => {
    linkTokenRequest();
  }, []);

  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token, metadata) => {
      // send public_token to a server
      const passData = { public_token, metadata };
      // change the public token to access token request for server
      try {
        const res = await fetch(`/api/plaid/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(passData),
        });

        if (res.status === 409) {
          router.push("/dashboard");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to exchange access-token");
        }

        const { plaid_item_uuid } = await res.json(); // This is plaid_items internal DB id
        if (!plaid_item_uuid) {
          throw new Error("plaid item uuid not found");
        }

        const syncRes = await fetch(`/api/plaid/sync-transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plaid_item_uuid }),
        });

        if (!syncRes.ok) {
          throw new Error("Failed to sync transactions");
        }

        const syncResult = await syncRes.json();
        console.log(syncResult);
        router.push("/dashboard");
      } catch (e) {
        console.log(e);
      }
    },
  });

  function handleClick() {
    open();
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
            className="w-fit bg-linear-to-r from-primary to-primary-container text-on-primary px-10 py-5 rounded-xl font-bold text-lg active:scale-95 transition-transform shadow-[0_0_20px_rgba(78,222,163,0.15)] flex items-center gap-3"
            onClick={handleClick}
            disabled={!ready}
          >
            Connect Bank
            <Landmark />
          </button>
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
        {/*api request*/}

        {
          error && <p>Error</p>
          // I will show real error message later
        }
      </section>
    </div>
  );
}
