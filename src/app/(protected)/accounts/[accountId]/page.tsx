import { getAccountDetailData } from "@/features/accounts/actions";
import AccountDetailPageClient from "@/features/accounts/pages/AccountDetailPageClient";

type Props = { params: Promise<{ accountId: string }> };

async function Page({ params }: Props) {
  const { accountId } = await params;
  const res = await getAccountDetailData(accountId);
  if (!res.ok) {
    return (
      <div>
        <h1>Accounts</h1>
        <p>{res.error}</p>
      </div>
    );
  }

  return <AccountDetailPageClient account={res.account} />;
}

export default Page;
