export type Transaction = {
  id: string;
  account_id: string;
  category_id: string;
  posted_at: string;
  amount: number;
  merchant: string;
  note: string;
};

export type DashboardType = {
  monthlyExpenses: Transaction[];
  monthlyIncome: Transaction[];
  monthlyTotoal: number;
  recentTransactions: Transaction[];
  todayTotal: number;
};
