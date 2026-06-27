import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { PlaidErrorResponse } from "../sync-transactions/route";

export function createPlaidClient() {
  const plaidClientId = process.env.PLAID_CLIENT_ID;
  const plaidSecret = process.env.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV || "sandbox";
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

export function getPlaidError(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as PlaidErrorResponse).response?.data ?? null;
  }

  return null;
}
