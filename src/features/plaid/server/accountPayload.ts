import "server-only";

import type { AccountBase } from "plaid";

export function toPlaidAccountPayload(accounts: AccountBase[]) {
  return accounts.map((account) => {
    const currency =
      account.balances.iso_currency_code ??
      account.balances.unofficial_currency_code;

    if (!currency) {
      throw new Error("Plaid account currency is missing");
    }

    return {
      plaid_account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      currency,
      current_balance: account.balances.current,
      available_balance: account.balances.available,
    };
  });
}
