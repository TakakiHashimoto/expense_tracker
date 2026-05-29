import { getTransactionPageData } from "@/features/tranactions/actions";
import TransactionPageClient from "@/features/tranactions/pages/TransactionPage";

async function TransactionPage() {
  const transactions = await getTransactionPageData();
  return <TransactionPageClient transactions={transactions} />;
}

export default TransactionPage;
