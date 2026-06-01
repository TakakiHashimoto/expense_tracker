export type TransactionItem = {
  id: string;
  name: string;
  amount: number;
  date: string;
  categoryName: string | null;
  categoryKind: "income" | "expense" | null;
  accountName: string | null;
  institutionName: string | null;
};

export type TransactionsPageData =
  | { ok: true; transactions: TransactionItem[] }
  | { ok: false; error: string };

// type for the filtering
export type TransactionTypeFilter =
  | "all"
  | "income"
  | "expense"
  | "uncategorized";

export type TransactionFilters = { type: TransactionTypeFilter };

export function parseTransactionTypeFilter(
  value: string | undefined,
): TransactionTypeFilter {
  if (value === "income" || value === "expense" || value === "uncategorized") {
    return value;
  }

  return "all";
}
