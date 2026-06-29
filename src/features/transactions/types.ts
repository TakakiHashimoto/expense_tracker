export type TransactionItem = {
  id: string;
  name: string;
  merchant: string;
  amount: number;
  date: string;
  categoryId: string | null;
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

// types for sorting
export type TransactionSort =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc";

export type TransactionFilters = {
  type: TransactionTypeFilter;
  sort: TransactionSort;
};

export type TransactionRowType = {
  id: string;
  amount: number;
  merchant: string | null;
  note: string | null;
  name: string | null;
  posted_at: string;
  payment_channel: string | null;
  pending: boolean;
  category: { id: string; name: string | null; kind: string };
  institutionName: { institution_name: string | null };
  account: { name: string; type: string; mask: number };
};

export function parseTransactionTypeFilter(
  value: string | undefined,
): TransactionTypeFilter {
  if (value === "income" || value === "expense" || value === "uncategorized") {
    return value;
  }

  return "all";
}

export function parseTransactionTypeSort(
  value: string | undefined,
): TransactionSort {
  if (
    value === "amount_desc" ||
    value === "amount_asc" ||
    value === "date_asc" ||
    value === "date_desc"
  ) {
    return value;
  }

  return "date_desc";
}
