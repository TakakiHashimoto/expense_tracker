import { CreditCard, MoveLeft, ShieldAlert } from "lucide-react";
import {
  AccountDetailPageData,
  ConnectionHealth,
  HealthPresentation,
} from "../types";
import Link from "next/link";
import { formatLastSync } from "../lib/formatSyncTime";
import { formatCurrency } from "../lib/formatCurrency";
import RepairConnectionButton from "../components/RepairConnectionButton";
import SyncInstitutionButton from "../components/SyncInstitutionButton";

type Props = { account: AccountDetailPageData };

function AccountDetailPageClient({ account }: Props) {
  const healthPresentation: Record<ConnectionHealth, HealthPresentation> = {
    healthy: {
      label: "Healthy",
      description: null,
      badgeClassName: "bg-primary/10 text-primary",
      action: null,
    },
    needs_update: {
      label: "Needs update",
      description:
        "Your bank requires you to update or confirm this connection.",
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

  const presentation = healthPresentation[account.health];

  return (
    <main className="ml-72 mt-12 p-12 max-w-container-max relative overflow-x-hidden">
      <Link
        href={"/accounts"}
        className="mb-8 flex items-center gap-2 text-slate-muted hover:text-primary transition-colors cursor-pointer w-max group"
      >
        <MoveLeft className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform" />
        <span className="font-label-bold text-label-bold uppercase">
          Back to Accounts
        </span>
      </Link>
      <section className="glass-panel rounded-2xl p-10 mb-section-gap relative overflow-hidden bg-surface-container-low border-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 relative z-10 mb-5">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center">
                <CreditCard className="material-symbols-outlined text-primary text-2xl" />
              </div>
              <div>
                <h2 className="font-bold text-5xl text-on-surface tracking-tight">
                  {account.name}
                </h2>
                <span className="text-slate-muted font-light">
                  ••••{account.mask}
                </span>
                <p className="text-slate-muted font-body-lg text-lg mt-1">
                  {account.institution.institution_name} • {account.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-6">
              {presentation.label === "Healthy" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-primary font-label-sm text-label-sm uppercase tracking-widest">
                    Healthy
                  </span>
                </div>
              )}

              {presentation.label === "Needs update" && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                  <span className="text-tertiary font-label-sm text-label-sm uppercase tracking-widest">
                    Needs update
                  </span>
                </div>
              )}

              <span className="text-slate-muted font-label-bold text-label-bold">
                Last Sync: {formatLastSync(account.institution.last_sync_at)}
              </span>
            </div>
          </div>
          <div className="text-right space-y-2">
            <p className="text-slate-muted font-label-bold text-label-bold uppercase">
              Current Balance
            </p>
            <h3 className="font-display-xl text-display-xl text-primary tracking-tight">
              {formatCurrency(account.currency, account.current_balance)}
            </h3>
            <p className="text-slate-muted font-body-md text-body-md flex items-center justify-end gap-2">
              Available Balance:{" "}
              <span className="text-on-surface font-medium">
                {formatCurrency(account.currency, account.available_balance)}
              </span>
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
      <div className="xl:col-span-4 space-y-6">
        <div className="flex flex-col gap-2">
          {presentation.description && (
            <div className="flex items-center gap-2 my-5">
              <ShieldAlert />
              <p>{presentation.description}</p>
              <p>Demo text</p>
            </div>
          )}

          {presentation.action === "repair" && (
            <RepairConnectionButton
              repairPlaidItemId={account.institution.id}
            />
          )}

          {presentation.action === "sync" && (
            <SyncInstitutionButton plaidItemId={account.institution.id} />
          )}
        </div>
        {/* <div className="glass-panel rounded-xl p-6 space-y-4 bg-surface-container-low border-0">
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
        </div> */}
      </div>
    </main>
  );
}

export default AccountDetailPageClient;
