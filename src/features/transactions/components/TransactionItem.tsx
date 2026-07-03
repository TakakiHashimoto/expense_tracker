import { formatAmount } from "@/lib/formatValue";
import { type TransactionItem } from "../types";
import Link from "next/link";
import { categIconMap } from "@/lib/categIconMap";
import { ReceiptText } from "lucide-react";

type Props = { transaction: TransactionItem };

function TransactionItemRow({ transaction }: Props) {
  const CategoryIcon =
    categIconMap[transaction.categoryName ?? "Uncategorized"] ?? ReceiptText;

  const textColor = transaction.amount > 0 ? "text-primary" : "text-tertiary";

  return (
    <Link
      href={`/transactions/${transaction.id}`}
      className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer"
    >
      <div className="flex items-center gap-6">
        <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center">
          <CategoryIcon className="h-5 w-5 text-secondary" />
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
          {transaction.institutionName ?? "Unknown institution"}
        </p>
        <p className="text-xs text-on-surface-variant">
          {transaction.accountName ?? "Unkwon account"}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-xl font-display font-bold ${textColor}`}>
          {formatAmount(transaction.amount)}
        </p>
      </div>
    </Link>
  );
}

export default TransactionItemRow;
