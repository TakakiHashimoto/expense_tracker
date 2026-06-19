// “What bank connections and accounts does this user have, and are they healthy?”

import { getAccountPageData } from "@/features/accounts/actions";
import { AccountPageData } from "@/features/accounts/types";
import { X } from "lucide-react";

async function AccountPage() {
  const data: AccountPageData = await getAccountPageData();

  const accounts = data.institutions;
X  return <div>page</div>;
}

export default AccountPage;
