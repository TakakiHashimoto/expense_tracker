import { ShieldAlert } from "lucide-react";
import { AccountPageInstitution } from "../types";
import AccountItem from "./AccountItem";
import RepairConnectionButton from "./RepairConnectionButton";
import type { ConnectionHealth, HealthPresentation } from "../types";

import SyncInstitutionButton from "./SyncInstitutionButton";
import { formatLastSync } from "../lib/formatSyncTime";

type Props = { institution: AccountPageInstitution };

const healthPresentation: Record<ConnectionHealth, HealthPresentation> = {
  healthy: {
    label: "Healthy",
    description: null,
    badgeClassName: "bg-primary/10 text-primary",
    action: null,
  },
  needs_update: {
    label: "Needs update",
    description: "Your bank requires you to update or confirm this connection.",
    badgeClassName: "bg-error-container/20 text-tertiary",
    action: "repair",
  },
  sync_failed: {
    label: "Sync failed",
    description:
      "The latest synchronization failed. Your previous data is still available.",
    badgeClassName: "bg-error-container/20 text-tertiary",
    action: "sync",
  },
  never_synced: {
    label: "Never synced",
    description:
      "This institution has not completed its first synchronization.",
    badgeClassName: "bg-surface-container-high text-on-surface-variant",
    action: "sync",
  },
  disconnected: {
    label: "Disconnected",
    description: "This institution is no longer connected.",
    badgeClassName: "bg-surface-container-high text-on-surface-variant",
    action: null,
  },
};

function AccountSection({ institution }: Props) {
  const initialLetter = institution.institutionName.slice(0, 1);
  const presentation = healthPresentation[institution.health];

  return (
    <section className="space-y-4">
      <header>
        {/* Institution identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#117aca] flex items-center justify-center text-white font-bold text-lg">
            {initialLetter}
          </div>
          <div>
            <h2 className="font-headline font-bold text-lg text-on-surface">
              {institution.institutionName}
            </h2>
            <p className="text-on-surface-variant text-[15px] font-medium tracking-wide">
              last synced at: {formatLastSync(institution.lastSyncedAt)}
            </p>
          </div>
          <div
            className={`${presentation.badgeClassName} inline rounded-full py-2 px-3`}
          >
            {presentation.label}
          </div>
        </div>
      </header>

      <div>
        {presentation.description && (
          <div>
            <ShieldAlert />
            <p>{presentation.description}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {institution.accounts.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No active accounts are available.
            </p>
          ) : (
            institution.accounts.map((account) => (
              <AccountItem key={account.id} account={account} />
            ))
          )}
        </div>

        {presentation.action === "repair" && (
          <RepairConnectionButton repairPlaidItemId={institution.plaidItemId} />
        )}

        {presentation.action === "sync" && (
          <SyncInstitutionButton plaidItemId={institution.plaidItemId} />
        )}
      </div>
    </section>
  );
}

export default AccountSection;
