// Here, exchange public token to access token and store access token and plaid items to database

import { grabUser } from "@/features/dashboard/actions";
import { fetchPlaidAccounts } from "@/features/plaid/server/accounts";
import { persistPlaidAccounts } from "@/features/plaid/server/persitstPlaidAccounts";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

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

    // destructure  client-sent publick_token, neccessary for exchanging access_token
    const { public_token, metadata } = await request.json();

    if (!public_token) {
      return NextResponse.json(
        { error: "public_token is not provided" },
        { status: 400 },
      );
    }

    // change the public token to access token
    const res = await client.itemPublicTokenExchange({
      public_token: public_token,
    });
    const { access_token, item_id } = res.data;
    // item_id = one item_id for one institution like TD

    const { data: existingItem, error: existingItemError } = await supabase
      .from("plaid_items")
      .select("id")
      .eq("user_id", user.id)
      .eq("plaid_item_id", item_id)
      .maybeSingle();

    if (existingItemError) {
      return NextResponse.json(
        { error: "Failed to check existing bank connection" },
        { status: 500 },
      );
    }

    if (existingItem) {
      return NextResponse.json(
        { error: "This bank connection is already connected." },
        { status: 409 },
      );
    }

    const institutionName = metadata?.institution?.name ?? null;
    const institutionId = metadata?.institution?.institution_id ?? null;
    // get authorative accounts from plaid
    const accounts = await fetchPlaidAccounts(client, access_token);
    const snapshotTime = new Date().toISOString();

    // fill up the plaid_item database
    const { data, error } = await supabase
      .from("plaid_items")
      .insert({
        user_id: user.id,
        plaid_item_id: item_id,
        institution_id: institutionId,
        institution_name: institutionName,
        transactions_cursor: null,
        status: "active",
        last_sync_status: "never_synced",
        last_sync_error: null,
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

    try {
      // add access_token and item_id to database
      const { error: plaidSecretsError } = await supabase
        .from("plaid_item_secrets")
        .insert({ access_token: access_token, plaid_item_id: plaidItemUuid });

      if (plaidSecretsError) {
        throw plaidSecretsError;
      }

      // add accounts to database
      await persistPlaidAccounts({
        supabase,
        userId: user.id,
        plaidItemUuid,
        accounts,
        snapshotTime,
      });
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
