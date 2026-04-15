// This is the redirect target where users are redirected to after clicking "Get Started"
// Means this page will have button and actual bank connect logic will take place

"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

const baseUrl = process.env.NEXT_PUBLIC_BASEURL;

export default function ConnectBank() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  async function linkTokenRequest() {
    const res = await fetch(`${baseUrl}/api/plaid/link-token`, {
      method: "POST",
    });
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
      const passData = {
        public_token,
        metadata,
      };
      // change the public token to access token request for server
      const res = await fetch(`${baseUrl}/api/plaid/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passData),
      });

      const plaid_item_uuid = await res.json();

      await fetch(`${baseUrl}/api/plaid/sync-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaid_item_uuid }),
      });

      if (error) {
        console.log(error);
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
    </div>
  );
}
