import { ShieldAlert } from "lucide-react";
import { AccountPageInstitution } from "../types";
import AccountItem from "./AccountItem";
import RepairConnectionButton from "./RepairConnectionButton";

type Props = { institution: AccountPageInstitution };

function AccountSection({ institution }: Props) {
  const isHealthy = institution.health === "healthy";
  const initialLetter = institution.institutionName.slice(0, 1);
  const isActionRequired = institution.health === "needs_update";

  return isActionRequired ? (
    <section className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#006fcf] flex items-center justify-center text-white font-bold text-lg">
            {initialLetter}
          </div>
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">
              {institution.institutionName}
            </h2>
            <p className="text-tertiary text-[11px] font-medium tracking-wide">
              Action Required
            </p>
          </div>
        </div>
        <div className="bg-error-container/20 text-tertiary px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
          Needs Update
        </div>
      </div>
      <div className="bg-surface-container-low rounded-2xl p-4 space-y-4">
        <div className="bg-surface-container-highest/20 p-3 rounded-xl flex items-start gap-3">
          <ShieldAlert className="material-symbols-outlined text-tertiary text-xl mt-0.5" />
          <p className="text-on-surface-variant text-xs leading-relaxed">
            This connection needs to be updated to maintain sync. Your bank
            requires periodic re-authentication for security.
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-4 flex justify-between items-center">
          {institution.accounts.map((acc) => (
            <AccountItem key={acc.id} account={acc} />
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <RepairConnectionButton repairPlaidItemId={institution.plaidItemId} />
        </div>
      </div>
    </section>
  ) : (
    <section className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#117aca] flex items-center justify-center text-white font-bold text-lg">
            {initialLetter}
          </div>
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">
              {institution.institutionName}
            </h2>
            <p className="text-on-surface-variant text-[11px] font-medium tracking-wide">
              last synced at: {institution.lastSyncedAt}
            </p>
          </div>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
          {isHealthy && "Healthy"}
        </div>
      </div>
      <div className="bg-surface-container-low rounded-2xl p-2 space-y-2">
        {institution.accounts.map((acc) => (
          <AccountItem key={acc.id} account={acc} />
        ))}
      </div>
    </section>
  );
}

export default AccountSection;
