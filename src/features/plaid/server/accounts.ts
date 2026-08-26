import { PlaidApi } from "plaid";

export async function fetchPlaidAccounts(
  plaidClient: PlaidApi,
  accessToken: string,
) {
  // to retrieve a list of accounts associated with any linked Item. Plaid will only return active bank accounts — that is, accounts that are not closed and are capable of carrying a balance
  const res = await plaidClient.accountsGet({ access_token: accessToken });
  const account = res.data.accounts;
  return account;
}
