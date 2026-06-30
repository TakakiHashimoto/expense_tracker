import { getAccountPageData } from "@/features/accounts/actions";
import AddAccountsPageClient from "@/features/accounts/pages/AddAccountsPageClient";
import { AccountPageData } from "@/features/accounts/types";

async function page() {
  const data: AccountPageData = await getAccountPageData();
  if (!data.ok) {
    return (
      <div>
        <h1>Accounts</h1>
        <p>{data.error}</p>
      </div>
    );
  }

  const institutions = data.institutions;
  return <AddAccountsPageClient institutions={institutions} />;
}

export default page;
