import { ChevronRight } from "lucide-react";
import { AccountPageAccount } from "../types";

type Props = { account: AccountPageAccount };

function AccountItem({ account }: Props) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 flex justify-between items-center hover:bg-surface-container transition-colors cursor-pointer group">
      <div className="space-y-1">
        <h3 className="text-on-surface font-semibold text-sm">
          {account.name}
        </h3>
        <p className="text-on-surface-variant text-xs flex items-center gap-2">
          <span>•••• {account.mask}</span>
          <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
          <span>128 txns</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-on-surface font-bold text-base">
          ${account.currentBalance ?? "-"}
        </p>

        <ChevronRight className="material-symbols-outlined text-on-surface-variant text-lg group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
}

export default AccountItem;
