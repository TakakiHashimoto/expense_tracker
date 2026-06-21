import { AccountPageInstitution } from "../types";
import AccountItem from "./AccountItem";

type Props = { institution: AccountPageInstitution };

function AccountSection({ institution }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#117aca] flex items-center justify-center text-white font-bold text-lg">
            C
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
          Healthy
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
