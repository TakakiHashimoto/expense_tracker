import { getTransactionPageData } from "@/features/transactions/actions";
import TransactionPageClient from "@/features/transactions/pages/TransactionPage";
import {
  parseTransactionTypeFilter,
  parseTransactionTypeSort,
} from "@/features/transactions/types";

type Props = {
  searchParams: Promise<{ type?: string; q?: string; sort?: string }>;
};

async function TransactionPage({ searchParams }: Props) {
  // This is how Nexjs catches the params
  const params = await searchParams;
  const filters = {
    type: parseTransactionTypeFilter(params.type),
    sort: parseTransactionTypeSort(params.sort),
  };
  const normalizedQuery = params.q?.trim().toLowerCase() || "";

  const transactions = await getTransactionPageData({
    filters,
    q: normalizedQuery,
  });

  return (
    <TransactionPageClient transactions={transactions} filters={filters} />
  );
}

export default TransactionPage;
