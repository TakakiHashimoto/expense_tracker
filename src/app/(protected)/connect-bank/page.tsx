// This is the redirect target where users are redirected to after clicking "Get Started"
// Means this page will have button and actual bank connect logic will take place

"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function ConnectBank() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
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
      } catch (e) {
        console.log(e);
      }
    },
  });

  function handleClick() {
    open();
  }

  return (
    <div>
      <p>Connect bank page</p>
      <button onClick={handleClick} disabled={!ready}>
        Connect your Bank
      </button>
      {/*api request*/}

      {
        error && <p>Error</p>
        // I will show real error message later
      }
    </div>
  );
}
