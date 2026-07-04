"use client";

import { usePathname, useRouter } from "next/navigation";
import { Categories } from "../types";
import { useState } from "react";
import SelectCategoryButton from "../components/SelectCategoryButton";
import { addBudget } from "../actions";
import { toast } from "sonner";

type Props = { categories: Categories[] };

function BudgetCreatePageClient({ categories }: Props) {
  const pathname = usePathname();
  // /budgets/create-budget
  // generateBreadcrumb(pathname)

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  const today = new Date();

  const [amount, setAmount] = useState<string>("");
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const router = useRouter();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCategoryId) {
      toast.error("Please select category", {
        className:
          "!bg-tertiary !text-on-tertiary border-tertiary !shadow-lg !text-lg",
      });
      return;
    }
    const formattedMonth = `${today.getFullYear()}-${String(month).padStart(2, "0")}-01`;
    try {
      setIsAdding(true);
      const result = await addBudget({
        categoryId: selectedCategoryId,
        amount: Number(amount),
        month: formattedMonth,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const categ = categories.find((ctg) => ctg.id === selectedCategoryId);
      toast.success(`Successfully added budget for ${categ?.name}`);
      router.refresh();
    } catch (e) {
      toast.error("Failed to add budgets");
    } finally {
      setIsAdding(false);
    }
  }

  function handleCancel() {
    setSelectedCategoryId(null);
    setAmount("");
    setMonth(today.getMonth() + 1);
  }

  return (
    <main className="grow lg:ml-72 min-h-screen relative overflow-hidden bg-background">
      <div className="relative z-10 p-gutter md:py-12 md:px-6 max-w-container-max mx-auto">
        <div className="mb-12">
          {/* <nav className="flex items-center gap-x-2 text-label-bold text-slate-muted mb-4 uppercase tracking-widest">
            <a className="hover:text-primary" href="#">
              Budgets
            </a>
            <span className="material-symbols-outlined text-[14px]">
              chevron_right
            </span>
            <span className="text-primary">New Strategy</span>
          </nav> */}
          <h2 className="font-display-lg text-display-lg text-on-surface tracking-tight">
            Define New Budget
          </h2>
          <p className="font-body-lg text-body-lg text-slate-muted max-w-2xl mt-2">
            Set precision-engineered financial boundaries for your assets and
            expenses. Our system monitors real-time flows to keep your wealth
            optimized.
          </p>
        </div>
        <div className="flex w-full">
          <div className="xl:col-span-7">
            <div className="glass-panel rounded-3xl p-card-padding shadow-lg relative overflow-hidden">
              <form
                className="space-y-10 space-x-6 p-10 relative z-10"
                onSubmit={(e) => handleSubmit(e)}
              >
                <div>
                  <label className="font-bold text-label-bold text-primary uppercase tracking-widest mb-6 block">
                    Select Capital Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {categories.map((categ) => (
                      <SelectCategoryButton
                        key={categ.id}
                        category={categ}
                        onClick={(id: string) => setSelectedCategoryId(id)}
                        selectedCategId={selectedCategoryId}
                      />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="font-label-bold text-label-bold text-primary uppercase tracking-widest mb-4 block">
                      Monthly Limit
                    </label>
                    <div className="relative group">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-headline-md">
                        $
                      </span>
                      <input
                        className="w-full bg-surface-container-lowest border-none focus:ring-2 focus:ring-primary/20 rounded-2xl py-6 pl-12 pr-6 font-headline-md text-headline-md text-on-surface transition-all"
                        type="number"
                        onChange={(e) => setAmount(e.target.value)}
                        value={amount}
                      />
                    </div>
                    <p className="text-label-sm text-slate-muted mt-2 px-2">
                      {/* TODO: Estimated yearly: $60,000.00 */}
                    </p>
                  </div>
                  <div>
                    <label className="font-label-bold text-label-bold text-primary uppercase tracking-widest mb-4 block">
                      Month
                    </label>
                    <div className="relative">
                      <select
                        className="w-full bg-surface-container-lowest border-none focus:ring-2 focus:ring-primary/20 rounded-2xl py-6 px-6 font-body-lg text-body-lg text-on-surface appearance-none cursor-pointer"
                        onChange={(e) => setMonth(Number(e.target.value))}
                        value={month}
                      >
                        <option value={1}>Jan</option>
                        <option value={2}>Feb</option>
                        <option value={3}>Mar</option>
                        <option value={4}>Apr</option>
                        <option value={5}>May</option>
                        <option value={6}>Jun</option>
                        <option value={7}>Jul</option>
                        <option value={8}>Aug</option>
                        <option value={9}>Sep</option>
                        <option value={10}>Oct</option>
                        <option value={11}>Nov</option>
                        <option value={12}>Dec</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
                  <button
                    className="w-full sm:w-auto bg-primary text-on-primary font-headline-md text-headline-md py-4 px-12 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    type="submit"
                    disabled={isAdding}
                  >
                    Create Budget
                  </button>
                  <button
                    className="w-full sm:w-auto text-slate-muted hover:text-on-surface font-body-lg text-body-lg py-4 px-8 transition-colors"
                    type="button"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
          {/* Insight later */}
          {/* <div className="xl:col-span-5 flex flex-col gap-y-8">
            <div className="glass-panel rounded-3xl p-8 border-l-4 border-l-primary relative">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-4">
                Market Context
              </h3>
              <p className="text-body-md text-slate-muted leading-relaxed">
                Based on your portfolio size and recent expenditure in{" "}
                <span className="text-primary font-bold">Transport</span>, an
                allocation of $5,000 monthly is 12% lower than your average.
                This shift will increase your investable liquidity by
                approximately 4.2% annually.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-label-bold text-slate-muted">
                    AVERAGE SPEND
                  </span>
                  <span className="text-on-surface font-mono">$5,680</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[88%]"></div>
                </div>
                <div className="flex justify-between items-center text-label-sm">
                  <span className="text-primary">Budget Goal</span>
                  <span className="text-slate-muted">Historic Avg</span>
                </div>
              </div>
            </div>
            <div className="glass-panel rounded-3xl p-8">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-6">
                Strategy Insights
              </h3>
              <div className="space-y-6">
                <div className="flex gap-x-4">
                  <span className="material-symbols-outlined text-primary">
                    analytics
                  </span>
                  <div>
                    <h4 className="font-label-bold text-label-bold text-on-surface mb-1">
                      AUTOMATIC RECONCILIATION
                    </h4>
                    <p className="text-body-md text-slate-muted">
                      All transactions tagged as 'Transport' will be
                      automatically attributed to this budget.
                    </p>
                  </div>
                </div>
                <div className="flex gap-x-4">
                  <span className="material-symbols-outlined text-primary">
                    security
                  </span>
                  <div>
                    <h4 className="font-label-bold text-label-bold text-on-surface mb-1">
                      ENCRYPTED NOTIFICATIONS
                    </h4>
                    <p className="text-body-md text-slate-muted">
                      Alerts are sent via secure obsidian-grade private channels
                      only.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl h-64 overflow-hidden relative group shadow-2xl">
              <div
                className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                data-alt="A wide angle photograph of a minimalist, luxury home interior with dark marble textures and large windows overlooking a rainy metropolis at night. Soft emerald neon reflections on the surfaces, high-end private banking atmosphere, sleek architectural lines, moody cinematic lighting."
              ></div>
              <div className="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent"></div>
              <div className="absolute bottom-6 left-8">
                <span className="text-label-sm text-primary uppercase tracking-[0.2em] block mb-1">
                  Visual Inspiration
                </span>
                <span className="font-headline-md text-on-surface">
                  Balanced Wealth
                </span>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </main>
  );
}

export default BudgetCreatePageClient;
