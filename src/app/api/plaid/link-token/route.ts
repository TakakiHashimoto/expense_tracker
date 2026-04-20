// Here in this page, get request from client and exchange link-token with plaid api and return link-token to a client

import {
  PlaidApi,
  Configuration,
  PlaidEnvironments,
  CountryCode,
  Products,
} from "plaid";
import { grabUser } from "@/features/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

export async function POST() {
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
  try {
    const res = await client.linkTokenCreate(linkTokenRequest);
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (e) {
    console.log(e);
    return NextResponse.json({
      error: { message: "Failed to create link token", code: "400" },
      success: false,
    });
  }
}
