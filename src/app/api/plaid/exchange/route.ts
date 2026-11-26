import { logPlaidError } from "@/features/plaid/server/errors";
import { withPlaidErrorBoundary } from "../lib/error-boundary";
import { fetchPlaidAccounts } from "@/features/plaid/server/accounts";
import { toPlaidAccountPayload } from "@/features/plaid/server/accountPayload";
import { isConfirmedCommitRejection } from "@/features/plaid/server/rpcCommitOutcome";
import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { createServerRoleClient } from "@/lib/supabase/server-role";
import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

function unconfirmedInitializationResponse() {
  return NextResponse.json(
    {
      error:
        "Bank connection outcome is unconfirmed. Check your dashboard before reconnecting.",
      code: "CONNECTION_OUTCOME_UNCONFIRMED",
    },
    { status: 503 },
  );
}

async function handlePost(request: NextRequest) {
  try {
    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Missing Plaid Credentials" },
        { status: 500 },
      );
    }

    // 1. Authenticate user

    const supabase = await createClient();
    const user = await grabUser(supabase);

    const { public_token, metadata } = await request.json();

    if (typeof public_token !== "string" || public_token.trim() === "") {
      return NextResponse.json(
        { error: "public_token is not provided" },
        { status: 400 },
      );
    }

    // 2. Initialize Plaid client

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

    // 3. Exchange public token
    const res = await client.itemPublicTokenExchange({ public_token });

    const { access_token, item_id } = res.data;

    // 4. Fetch authoritative account snapshot

    const accounts = await fetchPlaidAccounts(client, access_token);

    const snapshotTime = new Date().toISOString();

    const accountPayload = toPlaidAccountPayload(accounts);

    const institutionName = metadata?.institution?.name ?? null;

    const institutionId = metadata?.institution?.institution_id ?? null;

    // 5. Initialize Item, Secret and Accounts atomically

    const serverSupabase = createServerRoleClient();

    let data: unknown;
    let error: unknown;
    let status: number;

    try {
      ({ data, error, status } = await serverSupabase
        .rpc("initialize_plaid_item", {
          p_user_id: user.id,
          p_plaid_item_id: item_id,
          p_access_token: access_token,
          p_institution_id: institutionId,
          p_institution_name: institutionName,
          p_accounts: accountPayload,
          p_snapshot_time: snapshotTime,
        })
        .retry(false));
    } catch (cause) {
      logPlaidError("exchange", cause);

      return unconfirmedInitializationResponse();
    }

    // 6. Classify RPC errors

    if (
      error !== null ||
      !Number.isInteger(status) ||
      !(status >= 200 && status < 300)
    ) {
      logPlaidError("exchange", error);

      if (!isConfirmedCommitRejection(error, status)) {
        return unconfirmedInitializationResponse();
      }

      return NextResponse.json(
        { error: "Failed to connect bank account" },
        { status: 500 },
      );
    }

    // 7. Validate response shape

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return unconfirmedInitializationResponse();
    }

    const result = data as Record<string, unknown>;

    // 8. Handle duplicate connection

    if (result.status === "already_connected") {
      return NextResponse.json(
        {
          error: "This bank connection is already connected.",
          code: "ALREADY_CONNECTED",
        },
        { status: 409 },
      );
    }

    // 9. Return confirmed initialization

    if (
      result.status === "created" &&
      typeof result.item_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        result.item_id,
      )
    ) {
      return NextResponse.json({ plaid_item_uuid: result.item_id });
    }

    return unconfirmedInitializationResponse();
  } catch (error) {
    logPlaidError("exchange", error);

    return NextResponse.json(
      { error: "Failed to connect bank account" },
      { status: 500 },
    );
  }
}

export const POST = withPlaidErrorBoundary("exchange", handlePost);
