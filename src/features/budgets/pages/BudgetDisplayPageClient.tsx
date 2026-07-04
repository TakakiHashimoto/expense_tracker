function BudgetDisplayPageClient() {
  return (
    <main className="flex-1 ml-78 p-12 max-w-container-max mx-auto ">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface mb-2">
            Budgets
          </h2>
          <p className="text-body-lg font-body-lg text-slate-muted max-w-2xl">
            Manage your capital allocation across lifestyle and investment
            categories with precision.
          </p>
        </div>
        <button className="bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-md text-[1rem] px-8 py-4 rounded-xl shadow-lg shadow-primary/20 hover:scale-95 transition-transform flex items-center gap-2">
          <span className="material-symbols-outlined">add</span>
          Add Budget
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div className="glass-panel p-card-padding rounded-3xl emerald-glow transition-all duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">home</span>
            </div>
            <span className="text-label-bold font-label-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
              On Track
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
            Housing
          </h3>
          <p className="text-label-bold font-label-bold text-slate-muted uppercase mb-6">
            Monthly Allocation
          </p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display-xl text-[2rem] text-on-surface">
              $3,200
            </span>
            <span className="text-slate-muted font-body-md">/ $4,500</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary w-[71%] rounded-full shadow-[0_0_8px_rgba(78,222,163,0.4)]"></div>
          </div>
          <div className="flex justify-between text-label-bold font-label-bold">
            <span className="text-slate-muted">71% Used</span>
            <span className="text-on-surface">$1,300 Remaining</span>
          </div>
        </div>
        <div className="glass-panel p-card-padding rounded-3xl emerald-glow transition-all duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined">restaurant</span>
            </div>
            <span className="text-label-bold font-label-bold text-tertiary bg-tertiary/10 px-3 py-1 rounded-full">
              Warning
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
            Food &amp; Drink
          </h3>
          <p className="text-label-bold font-label-bold text-slate-muted uppercase mb-6">
            Culinary &amp; Dining
          </p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display-xl text-[2rem] text-on-surface">
              $1,850
            </span>
            <span className="text-slate-muted font-body-md">/ $2,000</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
            <div className="h-full bg-tertiary-container w-[92%] rounded-full shadow-[0_0_8px_rgba(252,124,120,0.4)]"></div>
          </div>
          <div className="flex justify-between text-label-bold font-label-bold">
            <span className="text-slate-muted">92% Used</span>
            <span className="text-on-surface">$150 Remaining</span>
          </div>
        </div>
        <div className="glass-panel p-card-padding rounded-3xl emerald-glow transition-all duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">directions_car</span>
            </div>
            <span className="text-label-bold font-label-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full">
              Optimal
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
            Transportation
          </h3>
          <p className="text-label-bold font-label-bold text-slate-muted uppercase mb-6">
            Auto &amp; Transit
          </p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display-xl text-[2rem] text-on-surface">
              $450
            </span>
            <span className="text-slate-muted font-body-md">/ $1,200</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
            <div className="h-full bg-secondary w-[37%] rounded-full shadow-[0_0_8px_rgba(173,198,255,0.4)]"></div>
          </div>
          <div className="flex justify-between text-label-bold font-label-bold">
            <span className="text-slate-muted">37% Used</span>
            <span className="text-on-surface">$750 Remaining</span>
          </div>
        </div>
        <div className="glass-panel p-card-padding rounded-3xl emerald-glow transition-all duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">theater_comedy</span>
            </div>
            <span className="text-label-bold font-label-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
              On Track
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
            Entertainment
          </h3>
          <p className="text-label-bold font-label-bold text-slate-muted uppercase mb-6">
            Lifestyle &amp; Leisure
          </p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display-xl text-[2rem] text-on-surface">
              $600
            </span>
            <span className="text-slate-muted font-body-md">/ $1,500</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary w-[40%] rounded-full shadow-[0_0_8px_rgba(78,222,163,0.4)]"></div>
          </div>
          <div className="flex justify-between text-label-bold font-label-bold">
            <span className="text-slate-muted">40% Used</span>
            <span className="text-on-surface">$900 Remaining</span>
          </div>
        </div>
        <div className="glass-panel p-card-padding rounded-3xl emerald-glow transition-all duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined">flight</span>
            </div>
            <span className="text-label-bold font-label-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full">
              Savings
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
            Travel
          </h3>
          <p className="text-label-bold font-label-bold text-slate-muted uppercase mb-6">
            Annual Reserve
          </p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display-xl text-[2rem] text-on-surface">
              $12,400
            </span>
            <span className="text-slate-muted font-body-md">/ $25,000</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
            <div className="h-full bg-secondary w-[50%] rounded-full"></div>
          </div>
          <div className="flex justify-between text-label-bold font-label-bold">
            <span className="text-slate-muted">50% Reserved</span>
            <span className="text-on-surface">$12,600 Remaining</span>
          </div>
        </div>
        <div className="glass-panel p-card-padding rounded-3xl emerald-glow transition-all duration-300">
          <div className="flex justify-between items-start mb-8">
            <div className="w-12 h-12 bg-surface-container-high rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">
                health_and_safety
              </span>
            </div>
            <span className="text-label-bold font-label-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
              On Track
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-1">
            Health
          </h3>
          <p className="text-label-bold font-label-bold text-slate-muted uppercase mb-6">
            Wellness &amp; Fitness
          </p>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="font-display-xl text-[2rem] text-on-surface">
              $820
            </span>
            <span className="text-slate-muted font-body-md">/ $1,000</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary w-[82%] rounded-full shadow-[0_0_8px_rgba(78,222,163,0.4)]"></div>
          </div>
          <div className="flex justify-between text-label-bold font-label-bold">
            <span className="text-slate-muted">82% Used</span>
            <span className="text-on-surface">$180 Remaining</span>
          </div>
        </div>
        <div className="border-2 border-dashed border-white/10 p-card-padding rounded-3xl flex flex-col items-center justify-center text-center group cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 min-h-[340px]">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-slate-muted group-hover:text-primary group-hover:scale-110 transition-all mb-4">
            <span className="material-symbols-outlined text-4xl">
              add_circle
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">
            Create Category
          </h3>
          <p className="text-body-md font-body-md text-slate-muted mt-2">
            Define new allocation rules for your portfolio.
          </p>
        </div>
      </div>
      <section className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-panel rounded-3xl p-card-padding">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="font-headline-md text-headline-md text-on-surface">
                Budget Utilization
              </h4>
              <p className="text-body-md text-slate-muted">
                Comparative spend analysis across last 6 months.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-label-bold font-label-bold border border-white/5">
                Monthly
              </button>
              <button className="px-4 py-2 rounded-lg text-slate-muted text-label-bold font-label-bold hover:bg-surface-container-high transition-colors">
                Quarterly
              </button>
            </div>
          </div>
          <div className="h-64 flex items-end gap-4 w-full px-4">
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[40%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[55%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[75%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[65%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[85%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-primary/80 rounded-t-lg h-[92%] relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-2 py-1 rounded font-bold">
                Current
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-4 text-label-bold font-label-bold text-slate-muted">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>
        <div className="lg:col-span-4 glass-panel rounded-3xl p-card-padding flex flex-col">
          <h4 className="font-headline-md text-headline-md text-on-surface mb-2">
            Portfolio Insights
          </h4>
          <p className="text-body-md text-slate-muted mb-8">
            AI-driven observations on your liquidity.
          </p>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  trending_down
                </span>
              </div>
              <div>
                <p className="text-on-surface font-label-bold text-label-bold">
                  Spending Reduced
                </p>
                <p className="text-body-md text-slate-muted">
                  Dining expenses decreased by 12% compared to last month.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 bg-tertiary/10 text-tertiary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  priority_high
                </span>
              </div>
              <div>
                <p className="text-on-surface font-label-bold text-label-bold">
                  Limit Approaching
                </p>
                <p className="text-body-md text-slate-muted">
                  Housing utilities are trending 5% higher than budgeted.
                </p>
              </div>
            </div>
            <button className="w-full mt-4 py-3 rounded-xl border border-white/5 bg-surface-container-low text-on-surface font-label-bold text-label-bold hover:bg-surface-container-high transition-all">
              View Detailed Audit
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default BudgetDisplayPageClient;
