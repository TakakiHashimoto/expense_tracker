"use client";

import { formatAmount } from "@/lib/formatValue";
import { CreditCard, MoveLeft, Pencil } from "lucide-react";
import Link from "next/link";
import EditCategoryComponent, { CategoryType } from "./EditCategoryComponent";
import { TransactionRowType } from "../types";
import { useState } from "react";
import { updateTransactionCategory } from "../server-actions";
import { toast } from "sonner";

type Props = { transaction: TransactionRowType; categories: CategoryType[] };

function TransactionDetailPageClient({ transaction, categories }: Props) {
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const traSec = transaction.posted_at.split("T")[1].split(".")[0].slice(0, 5);

  async function handleChangeCategory(categId: string | null) {
    try {
      setIsUpdating(true);
      await updateTransactionCategory({
        transactionId: transaction.id,
        categoryId: categId,
      });
      setIsEditModalOpen(false);
      toast.success("Successfully updated category");
    } catch (e) {
      toast.error("Failed to update category");
    } finally {
      setIsUpdating(false);
    }
  }
  return (
    <main className="ml-64 p-12 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-16">
          <Link
            href="/transactions"
            className="flex items-center space-x-6 gap-2 text-primary hover:scale-105 transition-transform"
          >
            <MoveLeft className="flex items-center text-primary hover:text-primary-container transition-colors font-medium" />
            GO BACK
          </Link>
          <h2 className="text-3xl font-display font-bold text-on-surface tracking-tight">
            Transaction Detail
          </h2>

          <button className="flex items-center px-6 py-3 rounded-full bg-linear-to-r from-primary to-primary-container text-on-primary font-bold hover:opacity-90 transition-opacity shadow-[0_8px_32px_rgba(78,222,163,0.15)]">
            <span className="material-symbols-outlined mr-2 text-sm">
              download
            </span>
            Download Receipt
          </button>
        </header>
        <section className="bg-surface-container-low rounded-4xl p-12 mb-12 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden group hover:bg-surface-container transition-colors duration-500">
          <div className="z-10">
            <p className="text-on-surface-variant text-sm font-medium uppercase tracking-widest mb-3">
              Merchant
            </p>
            <h3 className="text-5xl font-display font-black text-on-surface tracking-tighter mb-4">
              {transaction.merchant || transaction.name || "Unknown"}
            </h3>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-surface-container-highest text-primary-fixed-dim text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-primary-container mr-2 animate-pulse"></span>
              {transaction.pending ? "pending" : "completed"}
            </div>
          </div>
          <div className="z-10 mt-8 md:mt-0 text-right">
            <p className="text-on-surface-variant text-sm font-medium uppercase tracking-widest mb-3">
              Amount
            </p>
            <div
              className={`text-5xl font-display font-bold ${transaction.category?.kind === "expense" ? "text-tertiary" : "text-primary"} tracking-tight`}
            >
              {formatAmount(transaction.amount)}
            </div>
          </div>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-center">
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-2">
              Merchant Info
            </p>
            <p className="text-lg font-medium text-on-surface">
              {transaction.merchant}
            </p>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-center">
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-2">
              Date &amp; Time
            </p>
            <p className="text-lg font-medium text-on-surface">
              {new Intl.DateTimeFormat("en-CA", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(new Date(transaction.posted_at))}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">{traSec}</p>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-center">
            <div className="flex justify-between items-center w-full">
              <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-2">
                Category
              </p>
              <button onClick={() => setIsEditModalOpen((prev) => !prev)}>
                <Pencil className="flex items-center text-primary hover:text-primary-container font-medium cursor-pointer hover:scale-105 transition-all" />
              </button>
            </div>
            <div className="flex items-center text-lg font-medium text-on-surface">
              <span className="material-symbols-outlined mr-2 text-on-surface-variant text-xl">
                devices
              </span>
              {transaction.category?.name ?? "Uncategorized"}
            </div>

            {isEditModalOpen && (
              <EditCategoryComponent
                categories={categories}
                initialCetegId={transaction.category?.id || ""}
                changeCategory={handleChangeCategory}
                isUpdating={isUpdating}
              />
            )}
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-center">
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-2">
              Funding Source
            </p>
            <p className="text-lg font-medium text-on-surface flex items-center">
              <CreditCard className="material-symbols-outlined mr-2 text-secondary text-xl" />
              {transaction.account.name}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              {transaction.account.type} ...{transaction.account.mask}
            </p>
          </div>
          <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-center">
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-2">
              Institution
            </p>
            <p className="text-lg font-medium text-on-surface">
              {transaction.institutionName.institution_name}
            </p>
          </div>
          {/* <div className="bg-surface-container-lowest p-8 rounded-2xl flex flex-col justify-center">
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest mb-2">
              Network Status
            </p>
            <p className="text-lg font-medium text-on-surface">Cleared</p>
          </div> */}
        </section>
        {/* TODO: later implement following too (location ) */}
        {/* <section className="bg-surface-container-low p-10 rounded-[2rem]">
          <h4 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-8 border-l-2 border-primary-container pl-4">
            Technical Metadata
          </h4>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-container-lowest rounded-xl hover:bg-surface-container transition-colors">
              <span className="text-on-surface-variant text-sm w-48 mb-2 sm:mb-0">
                Plaid Reference
              </span>
              <div className="flex items-center text-on-surface font-mono text-sm bg-surface p-2 rounded-lg truncate ml-0 sm:ml-4 flex-1">
                <span className="truncate mr-4">
                  txn_5y7z92kLpQ01xR9m2a8B4c7D
                </span>
                <button
                  className="ml-auto text-primary hover:text-primary-container"
                  title="Copy ID"
                >
                  <span className="material-symbols-outlined text-sm">
                    content_copy
                  </span>
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-container-lowest rounded-xl hover:bg-surface-container transition-colors">
              <span className="text-on-surface-variant text-sm w-48 mb-2 sm:mb-0">
                Location
              </span>
              <span className="text-on-surface text-sm font-medium truncate ml-0 sm:ml-4 flex-1">
                767 5th Ave, New York, NY 10153
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-container-lowest rounded-xl hover:bg-surface-container transition-colors">
              <span className="text-on-surface-variant text-sm w-48 mb-2 sm:mb-0">
                Channel
              </span>
              <span className="text-on-surface text-sm font-medium ml-0 sm:ml-4 flex-1">
                In-store (EMV Contact)
              </span>
            </div>
          </div>
        </section> */}
      </div>
    </main>
  );
}

export default TransactionDetailPageClient;
