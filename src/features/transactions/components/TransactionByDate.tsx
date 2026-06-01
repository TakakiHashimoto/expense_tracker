import { TransactionItem } from "../types";
import TransactionItemRow from "./TransactionItem";

type Props = { convertedDate: string; transactions: TransactionItem[] };

function TransactionByDate({ convertedDate, transactions }: Props) {
  return (
    <div>
      <div className="flex items-center gap-4 px-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
          {convertedDate}
        </p>
        <div className="h-px flex-1 bg-on-surface-variant/5"></div>
      </div>
      {transactions.map((t) => (
        <TransactionItemRow key={t.id} transaction={t} />
      ))}
    </div>
  );
}

export default TransactionByDate;
