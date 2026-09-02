// 1. determine which plaid item user wants to add account to
// 2. get access_token needed for exchanging link_token
// 3. hit "/link/token/create " to obtain link_token.
// 4. return the link token to the front

// TODO: add webhook on production

import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { createPlaidClient } from "../lib/plaid.helper";
import { createServerRoleClient } from "@/lib/supabase/server-role";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  // get hold of plaid item id user intends to add account to
  const { plaidItemUuid } = await req.json();

  if (!plaidItemUuid) {
    return NextResponse.json(
      { error: "plaid item is not provided" },
      { status: 400 },
    );
  }

  // fetch plaid id
  const { data: plaidItem, error: plaidError } = await supabase
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("id", plaidItemUuid)
    .single();

  if (!plaidItem || plaidError) {
    console.error("Failed to fetch plaid item", plaidError);
    return NextResponse.json(
      { error: "Failed to fetch palid item" },
      { status: 500 },
    );
  }

  // fetch access_token
  const serverSupabase = createServerRoleClient();

  try {
    const { data: accessToken, error: secretError } = await serverSupabase
      .from("plaid_item_secrets")
      .select("access_token")
      .eq("plaid_item_id", plaidItem.id)
      .single();

    if (!accessToken || secretError) {
      console.error("Failed to fetch access token", secretError);
      return NextResponse.json(
        { error: "Failed to fetch access token" },
        { status: 500 },
      );
    }

    // obtain link token
    const configs = {
      user: { client_user_id: user.id },
      client_name: "Takaki's Expense Tracker",
      country_codes: [CountryCode.Ca],
      language: "en",
      access_token: accessToken.access_token,
      update: { account_selection_enabled: true },
      // webhook: "https://webhook.sample.com",
      // redirect_uri: "https://www.sample.com/redirect.html",
    };

    const client = createPlaidClient();

    const linkTokenResponse = client.linkTokenCreate(configs);
    return NextResponse.json(
      { ok: true, link_token: (await linkTokenResponse).data.link_token },
      { status: 200 },
    );
  } catch (e) {
    console.error("Failed to refresh accounts", e);

    return NextResponse.json(
      { error: "Failed to refresh accounts" },
      { status: 500 },
    );
  }
}
