export type Transaction = {
  id: string;
  account_id: string;
  category_id: string;
  posted_at: string;
  amount: number;
  merchant: string;
  note: string;
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
      recentTransactions: {
        id: string;
        name: string;
        amount: number;
        date: string;
        categoryName: string;
        categoryKind: string;
      }[];
    }
  | { ok: false; error: string };
