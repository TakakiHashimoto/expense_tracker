import AccountSection from "../components/AccountSection";
import { AccountPageInstitution } from "../types";

type Props = { accounts: AccountPageInstitution[] };

function AccountPageClient({ accounts }: Props) {
  const totalAccounts = accounts.reduce(
    (sum, cur) => sum + cur.accounts.length,
    0,
  );

  const healthyAccounts = accounts.filter((acc) => acc.health === "healthy");
  const actionRequiredAccounts = accounts.filter(
    (acc) => acc.health === "needs_update",
  );

  return (
    <main className="mt-24 px-6 space-y-10">
      <section className="flex justify-between items-end gap-4 py-4">
        <div className="flex flex-col">
          <span className="text-on-surface-variant font-label text-xs tracking-widest uppercase mb-1">
            Total Assets
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-8xl font-black text-on-surface leading-none tracking-tighter">
              {totalAccounts}
            </span>
            <div className="flex flex-col mb-1">
              <span className="text-on-surface-variant font-medium text-sm leading-tight">
                Active
                <br />
                Accounts
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1.5 text-right pb-1">
          <div className="flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-full">
            <span className="text-primary text-[10px] font-bold">●</span>
            <span className="text-on-surface-variant font-medium text-sm">
              {accounts.length === 1
                ? `${accounts.length} Institution`
                : `${accounts.length} Institutions`}
            </span>
          </div>
          <div className="text-on-surface-variant font-label text-[15px] space-y-0.5">
            <div className="flex items-center justify-end gap-2">
              <span className="text-primary">
                {healthyAccounts.length} Healthy
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span className="text-tertiary">
                {actionRequiredAccounts.length} Action Required
              </span>
            </div>
          </div>
        </div>
      </section>

      {accounts.map((insti) => (
        <AccountSection key={insti.plaidItemId} institution={insti} />
      ))}
      <div className="h-12 w-full flex justify-center items-center opacity-10">
        <div className="w-1.5 h-1.5 rounded-full bg-primary mx-1"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-primary mx-1"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-primary mx-1"></div>
      </div>
    </main>
  );
}

export default AccountPageClient;
