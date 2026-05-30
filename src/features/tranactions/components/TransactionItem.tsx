import { formatAmount } from "@/lib/formatValue";
import { type TransactionItem } from "../types";

type Props = { transaction: TransactionItem };

function TransactionItemRow({ transaction }: Props) {
  return (
    <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
      <div className="flex items-center gap-6">
        <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary">
            shopping_bag
          </span>
        </div>
        <div>
          <p className="font-bold text-slate-100">{transaction.name}</p>
          <p className="text-sm text-on-surface-variant">
            {transaction.categoryName ?? "Uncategorized"}
          </p>
        </div>
      </div>
      <div className="hidden md:block text-right">
        <p className="text-sm font-medium">
          {" "}
          {transaction.institutionName ?? "Unknown institution"}
        </p>
        <p className="text-xs text-on-surface-variant">
          {transaction.accountName}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xl font-display font-bold text-tertiary">
          {formatAmount(transaction.amount)}
        </p>
      </div>
    </div>
  );
}

export default TransactionItemRow;
