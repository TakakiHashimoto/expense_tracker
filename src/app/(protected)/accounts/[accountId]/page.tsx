import {
  getAccountDetailData,
  getAccountSpecificTransaction,
} from "@/features/accounts/actions";
import AccountDetailPageClient from "@/features/accounts/pages/AccountDetailPageClient";
import {
  parseTransactionTypeFilter,
  parseTransactionTypeSort,
} from "@/features/transactions/types";

type Props = {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ type?: string; q?: string; sort?: string }>;
};

async function Page({ params, searchParams }: Props) {
  const sParams = await searchParams;
  const { accountId } = await params;

  const filters = {
    type: parseTransactionTypeFilter(sParams.type),
    sort: parseTransactionTypeSort(sParams.sort),
  };
  const normalizedQuery = sParams.q?.trim().toLowerCase() || "";

  const accountDetailData = await getAccountDetailData(accountId);

  if (!accountDetailData.ok) {
    return (
      <div>
        <h1>Accounts</h1>
        <p>{accountDetailData.error}</p>
      </div>
    );
  }

  const accountSpecificTransaction = await getAccountSpecificTransaction({
    accountId,
    filters,
    q: normalizedQuery,
  });

  if (
    !accountSpecificTransaction.ok ||
    !accountSpecificTransaction.transactions
  ) {
    return (
      <div>
        <h1>Accounts</h1>
        <p>{accountSpecificTransaction.error}</p>
      </div>
    );
  }
  return (
    <AccountDetailPageClient
      account={accountDetailData.account}
      transactions={accountSpecificTransaction.transactions}
      filters={filters}
    />
  );
}

export default Page;
