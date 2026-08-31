// Here in this page, get request from client and exchange link-token with plaid api and return link-token to a client

// TODO: Now:
// - Keep webhook route implemented
// - Keep manual sync + repair flow working
// - Keep Accounts page reflecting stored DB truth

// Before deployment:
// - Add NEXT_PUBLIC_APP_URL or APP_BASE_URL
// - Add webhook: `${APP_BASE_URL}/api/plaid/webhook` to /api/plaid/link-token
// - Add Plaid webhook verification TODO
// - Rotate pasted secrets

// After deployment:
// - Connect a fresh bank Item and confirm webhook is registered
// - For old Items, optionally call /item/webhook/update

import {
  PlaidApi,
  Configuration,
  PlaidEnvironments,
  CountryCode,
  Products,
} from "plaid";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { grabUser } from "@/lib/getUser";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

export async function POST() {
  try {
    const supabase = await createClient();
    const user = await grabUser(supabase);

    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Missing Plaid Credentials" },
        { status: 500 },
      );
    }
    const config = new Configuration({
      basePath: PlaidEnvironments[plaidEnv],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": plaidClientId,
          "PLAID-SECRET": plaidSecret,
        },
      },
    });

    const client = new PlaidApi(config);

    // setting the config to pass into link token request
    const linkTokenRequest = {
      user: { client_user_id: user.id },
      client_name: "Takaki's Expense Tracker",
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca],
      language: "en",
      transactions: { days_requested: 90 },
    };

    // actually requesting to plaid api to get link token

    const res = await client.linkTokenCreate(linkTokenRequest);
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (e) {
    console.error("Failed to create link token:", e);
    return NextResponse.json(
      { error: { message: "Failed to create link token" }, success: false },
      { status: 500 },
    );
  }
}
