import { type SpendingByCategory } from "../type";

type Props = { spendingByCategory: SpendingByCategory[] };

function SpendingByCategory({ spendingByCategory }: Props) {
  return (
    <div className="bg-surface-container-low rounded-3xl p-8">
      <h3 className="text-xl font-bold text-slate-100 mb-8">
        Category Breakdown
      </h3>
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-300">Dining</span>
            <span className="text-xs text-on-surface-variant">
              $840.00 (42%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full"></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-300">
              Housing
            </span>
            <span className="text-xs text-on-surface-variant">
              $2,100.00 (35%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full"></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-300">
              Transport
            </span>
            <span className="text-xs text-on-surface-variant">
              $420.00 (12%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-tertiary rounded-full"
              //   style="width: 12%"
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-300">
              Entertainment
            </span>
            <span className="text-xs text-on-surface-variant">
              $210.00 (8%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              //   style="width: 8%"
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-slate-300">
              Shopping
            </span>
            <span className="text-xs text-on-surface-variant">
              $105.00 (3%)
            </span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-secondary rounded-full"
              //   style="width: 3%"
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpendingByCategory;
