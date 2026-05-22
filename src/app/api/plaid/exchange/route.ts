// Here, exchange public token to access token and store access token and plaid items to database

import { grabUser } from "@/features/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

type PlaidLinkAccount = {
  id: string;
  name: string;
  mask: string | null;
  type: string; // you can tighten later to union if you want
  subtype: string | null;
  verification_status?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Missing Plaid Credentials" },
        { status: 500 },
      );
    }

    const supabase = await createClient();
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

    const user = await grabUser(supabase);

    const { public_token, metadata } = await request.json();

    if (!public_token) {
      return NextResponse.json(
        { error: "public_token is not provided" },
        { status: 400 },
      );
    }

    const { count, error: existingError } = await supabase
      .from("plaid_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to check existing bank connection" },
        { status: 500 },
      );
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "User already have their banks connected" },
        { status: 409 },
      );
    }

    // change the public token to access token
    const res = await client.itemPublicTokenExchange({
      public_token: public_token,
    });
    const { access_token, item_id } = res.data;
    // item_id = one item_id for one institution like TD

    const institutionName = metadata?.institution?.name ?? null;
    const institutionId = metadata?.institution?.institution_id ?? null;
    const accounts: PlaidLinkAccount[] = metadata?.accounts ?? [];

    // fill up the plaid_item database
    const { data, error } = await supabase
      .from("plaid_items")
      .insert({
        user_id: user.id,
        plaid_item_id: item_id,
        institution_id: institutionId,
        institution_name: institutionName,
        transactions_cursor: null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to create plaid item" },
        { status: 500 },
      );
    }

    // database id for plaid_items
    const plaidItemUuid = data.id;

    // add access_token and item_id to database
    try {
      const { error: plaidSecretsError } = await supabase
        .from("plaid_item_secrets")
        .insert({ access_token: access_token, plaid_item_id: plaidItemUuid });

      if (plaidSecretsError) {
        throw plaidSecretsError;
      }

      // add accounts to database
      const addAccounts = accounts.map((account) => ({
        user_id: user.id,
        type: account.type,
        name: account.name,
        is_active: true,
        plaid_item_id: plaidItemUuid,
        plaid_account_id: account.id,
        mask: account.mask,
        subtype: account.subtype,
      }));

      const { error: accountError } = await supabase
        .from("accounts")
        .insert(addAccounts);

      if (accountError) {
        throw accountError;
      }
    } catch (writeError) {
      console.error("Rolling back failed Plaid exchange writes:", writeError);

      await supabase
        .from("plaid_items")
        .delete()
        .eq("id", plaidItemUuid)
        .eq("user_id", user.id);

      throw writeError;
    }

    return NextResponse.json({ plaid_item_uuid: plaidItemUuid });

    // get necessary data from another
    // add those transaction data to database
    // redirect to dashboard
  } catch (e) {
    console.error("Failed to connect bank account:", e);
    return NextResponse.json(
      { error: "Failed to connect bank account" },
      { status: 500 },
    );
  }
}

//     {
//   institution: {
//     name: 'Wells Fargo',
//     institution_id: 'ins_4'
//   },
//   accounts: [
//     {
//       id: 'ygPnJweommTWNr9doD6ZfGR6GGVQy7fyREmWy',
//       name: 'Plaid Checking',
//       mask: '0000',
//       type: 'depository',
//       subtype: 'checking',
//       verification_status: null
//     },
//     {
//       id: '9ebEyJAl33FRrZNLBG8ECxD9xxpwWnuRNZ1V4',
//       name: 'Plaid Saving',
//       mask: '1111',
//       type: 'depository',
//       subtype: 'savings'
//     }
//     ...
//   ],
//   link_session_id: '79e772be-547d-4c9c-8b76-4ac4ed4c441a'
// }
