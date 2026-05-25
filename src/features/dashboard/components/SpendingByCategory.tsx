import { type SpendingByCategory } from "../type";
import CategoryBreakdownItem from "./CategoryBreakdownItem";

type Props = { spendingByCategory: SpendingByCategory[] };

function SpendingByCategory({ spendingByCategory }: Props) {
  return (
    <div className="bg-surface-container-low rounded-3xl p-8">
      <h3 className="text-xl font-bold text-slate-100 mb-8">
        Category Breakdown
      </h3>
      {spendingByCategory.length === 0 ? (
        <div>
          <p className="text-sm text-on-surface-variant">
            No category spending found for this month.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {spendingByCategory.map((item) => (
            <CategoryBreakdownItem
              key={item.categoryName}
              categoryName={item.categoryName}
              amount={item.amount}
              percentage={item.percentage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SpendingByCategory;
