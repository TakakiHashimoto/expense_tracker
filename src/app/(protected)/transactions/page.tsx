import { getTransactionPageData } from "@/features/tranactions/actions";
import TransactionPageClient from "@/features/tranactions/pages/TransactionPage";
import { parseTransactionTypeFilter } from "@/features/tranactions/types";

type Props = { searchParams: Promise<{ type?: string }> };

async function TransactionPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = { type: parseTransactionTypeFilter(params.type) };

  const transactions = await getTransactionPageData(filters);

  return (
    <TransactionPageClient transactions={transactions} filters={filters} />
  );
}

export default TransactionPage;
