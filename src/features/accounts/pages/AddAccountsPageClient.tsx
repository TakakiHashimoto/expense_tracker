"use client";

import { useState } from "react";
import InstitutionSelectComponent from "../components/InstitutionSelectComponent";
import { AccountPageInstitution } from "../types";
import AddAccountButton from "@/components/addAccounts/AddAccountButton";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Props = { institutions: AccountPageInstitution[] };

function AddAccountsPageClient({ institutions }: Props) {
  const [selectedPlaidItemUuid, setSelectedPlaidItemUuid] = useState<
    string | null
  >(null);
  return (
    <main className="flex-1 ml-65 md:ml-sidebar-width min-h-screen px-gutter md:px-12 py-12 flex flex-col max-w-350 mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-2 text-primary font-bold mb-6 group cursor-pointer w-fit">
          <ChevronLeft className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1" />
          <Link
            href="/accounts"
            className="font-body-md uppercase tracking-widest text-label-bold"
          >
            Back to Accounts
          </Link>
        </div>
        <h2 className="text-5xl  text-on-surface mb-4">Add Account</h2>
        <p className="font-body-lg text-slate-muted max-w-2xl">
          Connect your financial institutions to sync your transactions and
          balances securely. We use bank-grade encryption to protect your data.
        </p>
      </header>

      <AddAccountButton plaidItemUuid={selectedPlaidItemUuid} />
      <section className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {institutions.map((ins) => (
            <InstitutionSelectComponent
              key={ins.plaidItemId}
              institutionName={ins.institutionName}
              plaidItemUuid={ins.plaidItemId}
              selected={selectedPlaidItemUuid === ins.plaidItemId}
              onClick={(id: string) => setSelectedPlaidItemUuid(id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default AddAccountsPageClient;
