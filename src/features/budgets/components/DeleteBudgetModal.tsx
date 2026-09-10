import { House, Trash2, X } from "lucide-react";
import { BudgetAnalysis } from "../types";

type Props = {
  onClose: () => void;
  onDelete: () => void;
  budget: BudgetAnalysis;
  isDeleting: boolean;
};

function DeleteBudgetModal({ onClose, onDelete, budget, isDeleting }: Props) {
  return (
    <div
      aria-labelledby="delete-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md transition-opacity duration-300"
      id="delete-budget-modal"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-container border border-white/10 rounded-3xl p-8 shadow-2xl transition-all duration-300"
        id="delete-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
              <Trash2 size={22} aria-hidden="true" />
            </div>
            <div>
              <h3
                className="font-headline-md text-on-surface"
                id="delete-modal-title"
              >
                Delete Budget
              </h3>
            </div>
          </div>
          <button
            aria-label="Close delete modal"
            className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
            id="delete-modal-close-btn"
            type="button"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="py-6 space-y-4">
          <div className="p-4 bg-surface-container-low rounded-2xl border border-white/5 flex items-center gap-3">
            <House
              className="text-tertiary shrink-0"
              size={22}
              id="delete-modal-category-icon"
              aria-hidden="true"
            />
            <div>
              <p
                className="font-label-bold text-on-surface tracking-wide uppercase"
                id="delete-modal-category-name"
              >
                {budget.category.name}
              </p>
            </div>
          </div>
          <p
            className="font-body-md text-muted leading-relaxed"
            id="delete-modal-prompt-text"
          >
            Are you sure you want to delete the{" "}
            <span
              className="text-on-surface font-semibold"
              id="delete-modal-category-highlight"
            >
              {budget.category.name}
            </span>{" "}
            budget? This will permanently remove this monthly budget. Your
            category and transaction history will not be deleted.
          </p>
        </div>
        <div className="pt-5 border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
          <button
            className="px-5 py-2.5 rounded-xl border border-white/10 bg-surface-container-low text-on-surface font-label-bold hover:bg-surface-container-high transition-colors"
            id="delete-modal-cancel-btn"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-6 py-2.5 rounded-xl bg-tertiary/90 hover:bg-tertiary text-background font-label-bold shadow-lg shadow-tertiary/20 transition-all flex items-center gap-1.5 cursor-pointer"
            id="delete-modal-confirm-btn"
            type="button"
            onClick={() => onDelete()}
            disabled={isDeleting}
          >
            <Trash2 size={18} aria-hidden="true" />
            {isDeleting ? "Deleting..." : "Delete Budget"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteBudgetModal;
