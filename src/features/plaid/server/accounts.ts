import { PlaidApi } from "plaid";

export async function fetchPlaidAccounts(
  plaidClient: PlaidApi,
  accessToken: string,
) {
  const res = await plaidClient.accountsGet({ access_token: accessToken });
  const account = res.data.accounts;
  return account;
}
