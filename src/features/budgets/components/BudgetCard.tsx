import { HeartPulse, SquarePen } from "lucide-react";
import { BudgetAnalysis } from "../types";
import { formatCurrency } from "@/features/accounts/lib/formatCurrency";

type Props = {
  budget: BudgetAnalysis;
  onEditClick: (budget: BudgetAnalysis) => void;
};

function BudgetCard({ budget, onEditClick }: Props) {
  const status = budget.isOverSpending
    ? "Over Spending"
    : budget.percentUsed > 80
      ? "Warning"
      : "On Track";

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
        <div className="flex flex-row items-center justify-center gap-2">
          <span
            className={`text-label-bold font-label-bold  px-3 py-1 rounded-full ${budgeColor}`}
          >
            {status}
          </span>
          <button
            className="bg-primary rounded-full p-2 cursor-pointer hover:shadow-primary/30 transition-all"
            onClick={() => onEditClick(budget)}
            type="button"
            aria-label={`Edit ${budget.category.name} budget`}
          >
            <SquarePen size={25} />
          </button>
        </div>
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
