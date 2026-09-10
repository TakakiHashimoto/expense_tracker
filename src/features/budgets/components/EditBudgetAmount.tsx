import { Check, X } from "lucide-react";
import { BudgetAnalysis } from "../types";
import { useState } from "react";
import { formatCurrency } from "@/features/accounts/lib/formatCurrency";

type Props = {
  onClose: () => void;
  onUpdate: (amount: number) => void;
  budget: BudgetAnalysis;
  isUpdating: boolean;
};

function EditBudgetAmount({ onClose, onUpdate, budget, isUpdating }: Props) {
  const [amountInput, setAmountInput] = useState(String(budget.amount));

  return (
    <div
      aria-labelledby="modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md transition-opacity duration-300"
      id="edit-amount-modal"
      role="dialog"
      onClick={() => onClose()}
    >
      <div
        className="relative group w-full max-w-lg min-h-85 max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-container border-2 border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
        id="modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-start justify-center pb-6 border-b border-white/10">
          <div className="flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-muted group-hover:text-primary group-hover:scale-110 transition-all duration-300 mb-4">
              <span className="material-symbols-outlined text-4xl">tune</span>
            </div>
            <div>
              <h3
                className="font-headline-md text-on-surface group-hover:text-primary transition-colors"
                id="modal-title"
              >
                Edit Budget Amount
              </h3>
              <p className="font-body-md text-muted mt-2">
                Adjust allocated monthly capital threshold
              </p>
            </div>
          </div>
          <button
            aria-label="Close modal"
            className="absolute top-0 right-0 w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
            id="modal-close-btn"
            onClick={() => onClose()}
          >
            <X className="material-symbols-outlined text-[20px]" />
          </button>
        </div>
        <div className="py-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-white/5">
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined text-primary text-[24px]"
                id="modal-category-icon"
              >
                category
              </span>
              <div>
                <p
                  className="font-label-bold text-label-bold text-on-surface uppercase tracking-wider"
                  id="modal-category-name"
                >
                  {budget.category.name}
                </p>
                <p className="text-xs text-muted">Current Limit</p>
              </div>
            </div>
            <div className="text-right">
              <span
                className="font-headline-md text-headline-md text-on-surface font-bold"
                id="modal-current-spent"
              >
                ${formatCurrency("CAD", budget.amount)}
              </span>
            </div>
          </div>
          <div>
            <label
              className="block text-label-bold font-label-bold text-on-surface mb-2 tracking-wide uppercase"
              htmlFor="budget-amount-input"
            >
              New Budget Limit (CAD)
            </label>
            <div className="relative rounded-2xl shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <span className="text-muted text-xl font-bold font-mono">
                  $
                </span>
              </div>
              <input
                className="block w-full rounded-2xl bg-surface-container-low border border-white/10 pl-9 pr-12 py-3.5 text-headline-md font-bold text-on-surface placeholder-muted focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                id="budget-amount-input"
                min="0.01"
                placeholder="0"
                step="50"
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                <span className="text-muted text-xs font-semibold uppercase tracking-wider">
                  CAD
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            className="px-6 py-3 rounded-xl border border-white/10 bg-surface-container-low text-on-surface text-label-bold font-label-bold hover:bg-surface-container-high transition-colors"
            id="modal-cancel-btn"
            type="button"
            onClick={() => onClose()}
          >
            Cancel
          </button>
          <button
            className="px-7 py-3 rounded-xl bg-linear-to-r from-primary to-primary-container text-on-primary text-label-bold font-label-bold shadow-lg shadow-primary/20 hover:scale-95 transition-all flex items-center gap-2"
            id="modal-save-btn"
            type="button"
            onClick={() => {
              const amount = Number(amountInput);
              onUpdate(amount);
            }}
            disabled={isUpdating}
          >
            <Check className="material-symbols-outlined text-[18px]" />
            {isUpdating ? "Updating your budget..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditBudgetAmount;
