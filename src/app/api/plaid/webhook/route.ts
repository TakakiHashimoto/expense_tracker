import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { PlaidWebhookBody } from "../type/plaidwebhook.type";
import { createClient } from "@supabase/supabase-js";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;
const plaidEnv = process.env.PLAID_ENV || "sandbox";

function createPlaidClient() {
  if (!plaidClientId || !plaidSecret) {
    throw new Error("Missing Plaid env vars");
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

  return client;
}

export async function POST(req: NextRequest) {
  let body: PlaidWebhookBody;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid Json" }, { status: 400 });
  }

  if (!body.item_id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing supabase URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing service role key");
  }
  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey, // Never expose this to the browser
    {
      auth: {
        persistSession: false, // Recommended for server operations
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
