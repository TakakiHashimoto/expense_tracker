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
        <div>No data to show for this month</div>
      ) : (
        <div className="space-y-6">
          {spendingByCategory.map((item) => (
            <CategoryBreakdownItem
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
