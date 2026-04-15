// Here, exchange public token to access token and store access token and plaid items to database

import { getUser } from "@/features/dashboard/actions";
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
  try {
    const { public_token, metadata } = await request.json();
    // change the public token to access token
    const res = await client.itemPublicTokenExchange({
      public_token: public_token,
    });
    const { access_token, item_id } = res.data;

    const {
      institution: { name, institution_id },
      accounts,
    } = metadata;

    // fill up the plaid_item database
    const user = await getUser(supabase);
    const { data } = await supabase
      .from("plaid_items")
      .insert({
        user_id: user.id,
        plaid_item_id: item_id,
        institution_id: institution_id,
        institution_name: name,
        transactions_cursor: null,
      })
      .select("id");

    // add access_token and item_id to database
    await supabase
      .from("plaid_item_secrets")
      .insert({ access_token: access_token, plaid_item_id: data?.[0].id });

    // add accounts to database
    for (const account of accounts) {
      await supabase.from("accounts").insert({
        user_id: user.id,
        type: account.type,
        name: account.name,
        is_active: true,
        plaid_item_id: data?.[0].id,
        plaid_account_id: account.id,
        mask: account.mask,
        subtype: account.subtype,
      });
    }

    return NextResponse.json({ plaid_item_uuid: data?.[0].id });

    // get necessary data from another
    // add those transaction data to database
    // redirect to dashboard
  } catch (e) {
    NextResponse.json({
      error: { message: "Failed to exchange access token", code: "400" },
    });
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
