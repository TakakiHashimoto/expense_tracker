import { formatAmount } from "@/lib/formatValue";

type Props = { categoryName: string; amount: number; percentage: number };

function CategoryBreakdownItem({ categoryName, amount, percentage }: Props) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-slate-300">
          {categoryName}
        </span>
        <span className="text-xs text-on-surface-variant">
          {formatAmount(amount)} ({percentage}%)
        </span>
      </div>
      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div
          className="h-full bg-secondary rounded-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default CategoryBreakdownItem;
