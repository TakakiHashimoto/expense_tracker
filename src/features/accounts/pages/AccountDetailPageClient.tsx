import { AccountDetailDataRow } from "../types";

type Props = { account: AccountDetailDataRow };

function AccountDetailPageClient({ account }: Props) {
  return (
    <main className="ml-72 mt-24 p-12 w-full max-w-container-max relative overflow-x-hidden">
      {/* Background Atmospheric effect */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      {/* Breadcrumb / Back Navigation (Contextual sub-page indicator) */}
      <div className="mb-8 flex items-center gap-2 text-slate-muted hover:text-primary transition-colors cursor-pointer w-max group">
        <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">
          arrow_back
        </span>
        <span className="font-label-bold text-label-bold uppercase">
          Back to Accounts
        </span>
      </div>
      {/* <!-- Editorial Hero Section --> */}
      <section className="glass-panel rounded-2xl p-10 mb-section-gap relative overflow-hidden bg-surface-container-low border-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 relative z-10">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-primary text-2xl"
                  data-icon="account_balance"
                >
                  account_balance
                </span>
              </div>
              <div>
                <h2 className="font-display-lg text-display-lg text-on-surface tracking-tight">
                  Chase Checking{" "}
                  <span className="text-slate-muted font-light">••••4291</span>
                </h2>
                <p className="text-slate-muted font-body-lg text-body-lg mt-1">
                  Chase Bank • Depository
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-primary font-label-sm text-label-sm uppercase tracking-widest">
                  Healthy
                </span>
              </div>
              <span className="text-slate-muted font-label-bold text-label-bold">
                Last Sync: Jun 19, 10:32 AM
              </span>
            </div>
          </div>
          <div className="text-right space-y-2">
            <p className="text-slate-muted font-label-bold text-label-bold uppercase">
              Current Balance
            </p>
            <h3 className="font-display-xl text-display-xl text-primary tracking-tight">
              $2,430.50
            </h3>
            <p className="text-slate-muted font-body-md text-body-md flex items-center justify-end gap-2">
              Available Balance:{" "}
              <span className="text-on-surface font-medium">$2,410.50</span>
              <span
                className="material-symbols-outlined text-sm cursor-help"
                data-icon="info"
                title="Pending transactions: $20.00"
              >
                info
              </span>
            </p>
          </div>
        </div>
      </section>
      {/* <!-- Bento Grid Layout for Main Content & Sidebar Actions --> */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
        {/* <!-- Main Content: Transactions (Spans 8 cols on desktop) --> */}
        <div className="xl:col-span-8 space-y-6">
          <h3 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mb-6">
            Recent Transactions
          </h3>
          <div className="glass-panel rounded-xl overflow-hidden bg-surface-container-low border-0">
            {/* <!-- Search/Filter Bar --> */}
            <div className="p-4 flex items-center gap-4 bg-surface-container-high">
              <div className="relative flex-1">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted text-sm"
                  data-icon="search"
                >
                  search
                </span>
                <input
                  className="w-full bg-surface-container-lowest border-0 rounded-lg pl-10 pr-4 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-body-md text-body-md placeholder-slate-muted"
                  placeholder="Search this account..."
                  type="text"
                />
              </div>
              <button className="p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest transition-colors text-slate-muted hover:text-on-surface">
                <span
                  className="material-symbols-outlined"
                  data-icon="filter_list"
                >
                  filter_list
                </span>
              </button>
            </div>
            {/* <!-- Transaction List --> */}
            <div className="divide-y-0">
              {/* <!-- Debit Item --> */}
              <div className="flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-slate-muted"
                      data-icon="devices"
                    >
                      devices
                    </span>
                  </div>
                  <div>
                    <h4 className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors">
                      Apple Store
                    </h4>
                    <p className="text-slate-muted font-body-md text-body-md">
                      Jun 18 • Electronics
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-body-lg text-body-lg text-on-surface block">
                    -$1,299.00
                  </span>
                  <span className="text-slate-muted font-label-bold text-label-bold uppercase">
                    Pending
                  </span>
                </div>
              </div>
              {/* <!-- Debit Item --> */}
              <div className="flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-slate-muted"
                      data-icon="local_cafe"
                    >
                      local_cafe
                    </span>
                  </div>
                  <div>
                    <h4 className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors">
                      Starbucks
                    </h4>
                    <p className="text-slate-muted font-body-md text-body-md">
                      Jun 17 • Dining
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-body-lg text-body-lg text-on-surface block">
                    -$4.50
                  </span>
                  <span className="text-slate-muted font-label-bold text-label-bold uppercase invisible">
                    Cleared
                  </span>
                </div>
              </div>
              {/* <!-- Credit Item --> */}
              <div className="flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                    <span
                      className="material-symbols-outlined"
                      data-icon="payments"
                    >
                      payments
                    </span>
                  </div>
                  <div>
                    <h4 className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors">
                      Acme Corp Payroll
                    </h4>
                    <p className="text-slate-muted font-body-md text-body-md">
                      Jun 15 • Direct Deposit
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-body-lg text-body-lg text-primary block">
                    +$3,500.00
                  </span>
                  <span className="text-slate-muted font-label-bold text-label-bold uppercase invisible">
                    Cleared
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-surface-container-low text-center rounded-b-xl">
              <button className="text-primary font-label-bold text-label-bold uppercase hover:text-primary-fixed transition-colors">
                View All Transactions
              </button>
            </div>
          </div>
        </div>
        {/* <!-- Sidebar Actions & Info (Spans 4 cols on desktop) --> */}
        <div className="xl:col-span-4 space-y-6">
          {/* <!-- Quick Actions Panel --> */}
          <div className="glass-panel rounded-xl p-6 space-y-4 bg-surface-container-low border-0">
            <h4 className="font-headline-md text-headline-md text-on-surface mb-4 pb-2">
              Account Actions
            </h4>
            <button className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-primary to-primary-container text-on-primary py-3 px-4 rounded-lg font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity transform hover:-translate-y-0.5">
              <span
                className="material-symbols-outlined text-sm"
                data-icon="sync"
              >
                sync
              </span>
              Sync Account
            </button>
            <button className="w-full flex items-center justify-center gap-2 bg-surface-container-high text-on-surface py-3 px-4 rounded-lg font-bold hover:bg-surface-container-highest transition-all">
              <span
                className="material-symbols-outlined text-sm"
                data-icon="build"
              >
                build
              </span>
              Repair Connection
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 text-slate-muted hover:text-error transition-colors mt-4">
              <span className="font-label-bold text-label-bold uppercase">
                Unlink Account
              </span>
              <span
                className="material-symbols-outlined text-sm"
                data-icon="link_off"
              >
                link_off
              </span>
            </button>
          </div>
          {/* <!-- Security Details Panel --> */}
          <div className="glass-panel rounded-xl p-6 bg-surface-container-low border-0">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="material-symbols-outlined text-primary"
                data-icon="verified_user"
              >
                verified_user
              </span>
              <h4 className="font-headline-md text-headline-md text-on-surface">
                Security Details
              </h4>
            </div>
            <ul className="space-y-3">
              <li className="flex justify-between items-center py-2 border-b-0 bg-surface-container-highest/20 px-3 rounded-lg">
                <span className="text-slate-muted font-body-md text-body-md">
                  Encryption
                </span>
                <span className="text-on-surface font-body-lg text-body-lg">
                  AES-256
                </span>
              </li>
              <li className="flex justify-between items-center py-2 border-b-0 bg-surface-container-highest/20 px-3 rounded-lg">
                <span className="text-slate-muted font-body-md text-body-md">
                  Status
                </span>
                <div className="flex items-center gap-1.5 text-primary">
                  <span
                    className="material-symbols-outlined text-sm"
                    data-icon="check_circle"
                  >
                    check_circle
                  </span>
                  <span className="font-label-bold text-label-bold uppercase">
                    Verified
                  </span>
                </div>
              </li>
              <li className="flex justify-between items-center py-2 border-b-0 bg-surface-container-highest/20 px-3 rounded-lg">
                <span className="text-slate-muted font-body-md text-body-md">
                  Institution
                </span>
                <span className="text-on-surface font-body-lg text-body-lg">
                  JPMorgan Chase
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

export default AccountDetailPageClient;
