import { getTransactionDetail } from "@/features/transactions/actions";
import TransactionDetailPageClient from "@/features/transactions/components/TransactionDetailPageClient";

type Props = { params: Promise<{ transactionId: string }> };

async function page({ params }: Props) {
  const { transactionId } = await params;
  const data = await getTransactionDetail(transactionId);
  const transaction = data.transaction;
  const cetegories = data.categories;

  return (
    <TransactionDetailPageClient
      transaction={transaction}
      categories={cetegories}
    />
  );
}

export default page;
