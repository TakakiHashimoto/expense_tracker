import { categIconMap } from "@/lib/categIconMap";
import { Categories } from "../types";
import { ReceiptText } from "lucide-react";

type Props = {
  category: Categories;
  onClick: (id: string) => void;
  selectedCategId: string | null;
};

function SelectCategoryButton({ category, onClick, selectedCategId }: Props) {
  const CategoryIcon =
    categIconMap[category.name ?? "Uncategorized"] ?? ReceiptText;

  const buttonColor =
    selectedCategId === category.id
      ? "bg-primary/50 border border-primary/40"
      : "bg-surface-container border border-glass-border hover:border-primary/40 hover:bg-surface-emerald-tint";

  return (
    <button
      className={`flex flex-col items-center justify-center gap-y-3 p-6 rounded-2xl  transition-all group ${buttonColor}`}
      type="button"
      onClick={() => onClick(category.id)}
    >
      <CategoryIcon className="material-symbols-outlined text-3xl text-slate-muted group-hover:text-primary transition-colors" />
      <span className="font-label-bold text-label-bold text-on-surface">
        {category.name}
      </span>
    </button>
  );
}

export default SelectCategoryButton;
