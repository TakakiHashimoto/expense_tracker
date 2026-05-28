import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json(
      { error: "Failed to find a user" },
      { status: 401 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "User is not authenticated" },
      { status: 401 },
    );
  }

  try {
    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Missing plaid credential" },
        { status: 500 },
      );
    }

    const { plaid_item_uuid } = await request.json();

    if (!plaid_item_uuid || typeof plaid_item_uuid !== "string") {
      return NextResponse.json({ error: "Missing plaid id" }, { status: 400 });
    }

    const { data: plaidItem, error: plaidItemError } = await supabase
      .from("plaid_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", plaid_item_uuid)
      .single();

    if (!plaidItem || plaidItemError) {
      return NextResponse.json(
        { error: "Plaid Item not found" },
        { status: 404 },
      );
    }

    // fetch the access_token
    const { data: accessToken, error: accessTokenError } = await supabase
      .from("plaid_item_secrets")
      .select("access_token")
      .eq("plaid_item_id", plaid_item_uuid)
      .single();

    if (accessTokenError || !accessToken) {
      return NextResponse.json(
        { error: "Failed to fetch access token" },
        { status: 404 },
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
      country_codes: [CountryCode.Ca],
      language: "en",
      access_token: accessToken.access_token,
    };

    const linkTokenResponse = await client.linkTokenCreate(linkTokenRequest);
    return NextResponse.json(
      { link_token: linkTokenResponse.data.link_token },
      { status: 200 },
    );
  } catch (e) {
    console.error("Failed to create update link token", e);
    return NextResponse.json(
      { error: "Failed to create update link token" },
      { status: 500 },
    );
  }
}
