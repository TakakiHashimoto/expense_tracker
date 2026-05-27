import { DashboardAccounts } from "../type";

type Props = { account: DashboardAccounts };

function AccountItem({ account }: Props) {
  const accountType = [account.type, account.subtype]
    .filter(Boolean)
    .join(" / ");
  const mask = account.mask ? `•••• ${account.mask}` : "No mask";
  const institutionName = account.institutionName ?? "Linked institution";

  return (
    <div className="group rounded-3xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-white/3 hover:shadow-xl">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/10 transition-colors group-hover:bg-primary/15">
            <span className="material-symbols-outlined text-3xl text-primary">
              account_balance
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-widest text-on-surface-variant/70">
              {institutionName}
            </p>
            <h4 className="truncate text-lg font-bold text-on-surface">
              {account.name}
            </h4>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
            account.isActive
              ? "bg-primary/10 text-primary ring-1 ring-primary/20"
              : "bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20"
          }`}
        >
          {account.isActive ? "active" : "inactive"}
        </span>
      </div>

      <div className="rounded-2xl bg-surface-container-lowest/50 px-4 py-3">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
          Account Type
        </p>
        <p className="truncate text-sm font-semibold capitalize text-slate-200">
          {accountType || "Account"}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-outline-variant/10 pt-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
            Number
          </p>
          <p className="truncate font-mono text-sm tracking-widest text-on-surface-variant">
            {mask}
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
          <span className="material-symbols-outlined text-lg text-on-surface-variant">
            account_balance
          </span>
        </div>
      </div>
    </div>
  );
}

export default AccountItem;
