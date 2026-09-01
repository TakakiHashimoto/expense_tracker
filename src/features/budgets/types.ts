export type Categories = { id: string; name: string };

export type CategoryReturnType =
  | { ok: true; categories: Categories[] }
  | { ok: false; error: string };

export type BudgetsRowType = {
  id: string;
  month: string;
  amount: number;
  category: { id: string; name: string; kind: "expense" };
};

export type BudgetAnalysis = BudgetsRowType & {
  spent: number;
  percentUsed: number;
  remaining: number;
  isOverSpending: boolean;
};

export type BudgetAnalysisReturn =
  | { ok: false; error: string }
  | { ok: true; data: BudgetAnalysis[] };
