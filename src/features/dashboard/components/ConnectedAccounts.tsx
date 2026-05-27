import Link from "next/link";
import { DashboardAccounts } from "../type";
import AccountItem from "./AccountItem";

type Props = { accounts: DashboardAccounts[] };

function ConnectedAccounts({ accounts }: Props) {
  const activeAccounts = accounts.filter((a) => a.isActive);
  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between px-2">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold tracking-tight">
            Connected Accounts
          </h3>
          <p className="text-on-surface-variant text-sm flex items-center gap-2">
            Total:{" "}
            <span className="text-on-surface font-semibold">
              {accounts.length}
            </span>{" "}
            • Active:{" "}
            <span className="text-primary font-semibold">
              {activeAccounts.length}
            </span>
          </p>
        </div>
        <Link
          className="text-primary text-sm font-bold hover:underline underline-offset-4"
          href="#"
        >
          Manage Accounts
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {accounts.slice(0, 3).map((account) => (
          <AccountItem key={account.id} account={account} />
        ))}
      </div>
    </section>
  );
}

export default ConnectedAccounts;
