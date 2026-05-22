// this page is for each recent transaction item, such "starbuck foods -$4"

// how to get category ?
import formatTransactionDate from "@/lib/formatTransactionDate";
import { formatAmount } from "@/lib/formatValue";

type RecentTransactionItemPorp = {
  shop: string;
  category: string | null;
  categoryKind: "income" | "expense" | null;
  date: string;
  amount: number;
};

const categoryIcons: Record<string, string> = {
  Bills: "receipt_long",
  Entertainment: "movie",
  Food: "local_cafe",
  Groceries: "local_grocery_store",
  Refund: "undo",
  Salary: "payments",
  Shopping: "shopping_bag",
  Transport: "directions_car",
};

function RecentTransactionItem({
  shop,
  category,
  categoryKind,
  date,
  amount,
}: RecentTransactionItemPorp) {
  const isIncome = categoryKind === "income" || amount > 0;
  const icon = category ? categoryIcons[category] : null;

  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-xl transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-12 h-12 rounded-2xl flex shrink-0 items-center justify-center transition-all ${
            isIncome
              ? "bg-primary-container/20 group-hover:bg-primary-container/30"
              : "bg-surface-container-highest group-hover:bg-surface-container-high"
          }`}
        >
          <span
            className={`material-symbols-outlined ${
              isIncome ? "text-primary" : "text-on-surface-variant"
            }`}
          >
            {isIncome ? "payments" : (icon ?? "receipt_long")}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-100 truncate">{shop}</p>
          <p className="text-xs text-on-surface-variant truncate">
            {category ?? "Uncategorized"} • {formatTransactionDate(date)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 pl-4">
        <p
          className={`font-bold ${isIncome ? "text-primary" : "text-tertiary"}`}
        >
          {isIncome ? "+" : "-"}
          {formatAmount(amount)}
        </p>
        {/* Later will add if pending: "pending": "approved" */}
        {/* <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter font-semibold">
          Approved
        </p> */}
      </div>
    </div>
  );
}

export default RecentTransactionItem;
