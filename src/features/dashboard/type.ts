export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  posted_date: string;
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
  postedDate: string;
  categoryName: string | null;
  categoryKind: "income" | "expense" | null;
};

export type SpendingByCategory = {
  categoryName: string;
  amount: number;
  percentage: number;
};

export type DashboardAccount = {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  mask: string | null;
  institutionName: string | null;
  isActive: boolean;
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
      spendingByCategory: SpendingByCategory[];
      accounts: DashboardAccount[];
    }
  | { ok: false; error: string };
