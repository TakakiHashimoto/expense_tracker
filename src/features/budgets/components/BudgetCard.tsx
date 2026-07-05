import { HeartPulse } from "lucide-react";
import { BudgetAnalysis } from "../types";
import { formatCurrency } from "@/features/accounts/lib/formatCurrency";

type Props = { budget: BudgetAnalysis };

function BudgetCard({ budget }: Props) {
  const status =
    budget.percentUsed <= 80
      ? "On Track"
      : budget.percentUsed > 80 && budget.percentUsed < 100
        ? "Warning"
        : "Over Spending";

  const budgeColor =
    status === "On Track"
      ? "text-primary bg-primary/10"
      : status === "Warning"
        ? "text-yellow-500 bg-yellow-500/10"
        : "text-tertiary bg-tertiary/10";

  const displayPercent = Math.min(budget.percentUsed, 100);
  const usageBar = `${displayPercent}%`;
  return (
    <div className="glass-panel p-5 rounded-3xl emerald-glow transition-all duration-300">
      <div className="flex justify-between items-start mb-8">
        <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-primary">
          <HeartPulse className="material-symbols-outlined" />
        </div>
        <span
          className={`text-label-bold font-label-bold  px-3 py-1 rounded-full ${budgeColor}`}
        >
          {status}
        </span>
      </div>
      <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
        {budget.category.name ?? "Unknown"}
      </h3>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="font-display-xl text-[2rem] text-on-surface">
          {formatCurrency("CAD", budget.spent)}
        </span>
        <span className="text-slate-muted font-body-md">
          / {formatCurrency("CAD", budget.amount)}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
        <div
          className={`h-full bg-primary rounded-full shadow-[0_0_8px_rgba(78,222,163,0.4)]`}
          style={{ width: usageBar }}
        ></div>
      </div>
      <div className="flex justify-between text-label-bold font-label-bold">
        <span className="text-slate-muted">{budget.percentUsed}% Used</span>
        <span className="text-on-surface">
          {formatCurrency("CAD", budget.remaining)} Remaining
        </span>
      </div>
    </div>
  );
}

export default BudgetCard;
