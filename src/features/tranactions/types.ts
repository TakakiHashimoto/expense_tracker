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
