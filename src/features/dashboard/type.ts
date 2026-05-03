export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  posted_at: string;
  amount: number;
  merchant: string | null;
  note: string | null;
};

export type TransactionRow = Transaction & {
  category: { name: string; kind: "income" | "expense" } | null;
};

export type RecentTransaction = {
  id: string;
  name: string;
  amount: number;
  date: string;
  categoryName: string | null;
  categoryKind: "income" | "expense" | null;
};

export type DashboardData =
  | { ok: true; hasPlaidItems: false }
  | {
      ok: true;
      hasPlaidItems: true;
      stats: {
        monthlySpending: number;
        monthlyIncome: number;
        todayTotal: number;
        recentActivities: number;
      };
      recentTransactions: RecentTransaction[];
    }
  | { ok: false; error: string };
