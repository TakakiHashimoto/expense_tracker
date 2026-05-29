import { TransactionItem, TransactionsPageData } from "../types";

type Props = { transactions: TransactionsPageData };

function TransactionPageClient({ transactions }: Props) {
  if (!transactions.ok) {
    // Failed to fetch data try again
    return;
  }
  return (
    <div className="pt-32 pb-20 px-10 max-w-7xl mx-auto space-y-10">
      <section>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">
          Transactions
        </h1>
        <p className="text-on-surface-variant mt-2 text-lg">
          Your latest account activity across all linked assets.
        </p>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col justify-between h-36">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-70">
            Total Activity
          </span>
          <p className="text-3xl font-display font-bold">$142,890.44</p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col justify-between h-36">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-70">
            Total Income
          </span>
          <p className="text-3xl font-display font-bold text-primary">
            +$24,500.00
          </p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col justify-between h-36 border-l-4 border-tertiary">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-70">
            Total Expenses
          </span>
          <p className="text-3xl font-display font-bold text-tertiary">
            -$12,410.12
          </p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col justify-between h-36">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-70">
            Net Movement
          </span>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-display font-bold">+$12,089.88</p>
            <span className="text-xs text-primary mb-1">↑ 4.2%</span>
          </div>
        </div>
      </section>
      <section className="flex flex-col md:flex-row gap-6 items-end justify-between">
        <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-2 rounded-xl w-full max-w-md transition-all focus-within:bg-surface-container-low group">
          <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full placeholder:text-on-surface-variant/40"
            placeholder="Search merchants, categories, or amounts..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl">
          <button className="px-6 py-2 rounded-lg text-sm font-semibold bg-surface-container-highest text-primary transition-all">
            All
          </button>
          <button className="px-6 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-all">
            Income
          </button>
          <button className="px-6 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-all">
            Expenses
          </button>
          <button className="px-6 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-all">
            Uncategorized
          </button>
        </div>
      </section>
      <section className="space-y-4">
        <div className="flex items-center gap-4 px-2">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
            Today, Oct 24
          </p>
          <div className="h-px flex-1 bg-on-surface-variant/5"></div>
        </div>
        <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">
                shopping_bag
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-100">Apple Store Fifth Ave</p>
              <p className="text-sm text-on-surface-variant">
                Technology • 10:42 AM
              </p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">Obsidian Black Visa</p>
            <p className="text-xs text-on-surface-variant">Checking ...8842</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-display font-bold text-tertiary">
              -$1,299.00
            </p>
          </div>
        </div>
        <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                coffee
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-100">Blue Bottle Coffee</p>
              <p className="text-sm text-on-surface-variant">
                Dining &amp; Drinks • 08:15 AM
              </p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">Obsidian Black Visa</p>
            <p className="text-xs text-on-surface-variant">Checking ...8842</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-display font-bold text-tertiary">
              -$6.50
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 px-2 pt-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/50">
            Yesterday, Oct 23
          </p>
          <div className="h-px flex-1 bg-on-surface-variant/5"></div>
        </div>
        <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">
                payments
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-100">
                Internal Revenue Service
              </p>
              <p className="text-sm text-on-surface-variant">
                Tax Refund • 03:22 PM
              </p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">Primary Savings</p>
            <p className="text-xs text-on-surface-variant">
              Wealth Management ...0012
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-display font-bold text-primary">
              +$4,250.00
            </p>
          </div>
        </div>
        <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">
                flight
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-100">Delta Air Lines</p>
              <p className="text-sm text-on-surface-variant">
                Travel • 11:05 AM
              </p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">Obsidian Black Visa</p>
            <p className="text-xs text-on-surface-variant">Checking ...8842</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-display font-bold text-tertiary">
              -$840.12
            </p>
          </div>
        </div>
        <div className="group flex items-center justify-between p-4 hover:bg-white/5 rounded-2xl transition-all cursor-pointer">
          <div className="flex items-center gap-6">
            <div className="h-12 w-12 rounded-xl bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-on-surface-variant">
                help_center
              </span>
            </div>
            <div>
              <p className="font-bold text-slate-100">Unknown Merchant 0221</p>
              <p className="text-sm text-on-surface-variant">
                Uncategorized • 09:30 AM
              </p>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium">Obsidian Black Visa</p>
            <p className="text-xs text-on-surface-variant">Checking ...8842</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-display font-bold text-tertiary">
              -$12.00
            </p>
          </div>
        </div>
      </section>
      <footer className="flex justify-center pt-10 pb-20">
        <button className="px-10 py-4 bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all rounded-full text-sm font-bold active:scale-95">
          View older activity
        </button>
      </footer>
    </div>
  );
}

export default TransactionPageClient;
