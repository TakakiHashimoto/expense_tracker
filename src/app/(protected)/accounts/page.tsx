// “What bank connections and accounts does this user have, and are they healthy?”

import { getAccountPageData } from "@/features/accounts/actions";
import AccountPageClient from "@/features/accounts/pages/AccountPageClient";
import { AccountPageData } from "@/features/accounts/types";

async function AccountPage() {
  const data: AccountPageData = await getAccountPageData();

  if (!data.ok) {
    return (
      <div>
        <h1>Accounts</h1>
        <p>{data.error}</p>
      </div>
    );
  }
  const accounts = data.institutions;
  return <AccountPageClient accounts={accounts} />;
}

export default AccountPage;
