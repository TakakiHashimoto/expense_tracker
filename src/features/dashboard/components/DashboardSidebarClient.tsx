"use client";

import { User } from "@supabase/supabase-js";
import {
  BadgeDollarSign,
  CalendarSync,
  CircleUserRound,
  LayoutDashboard,
  Receipt,
  Settings,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const activeClass = "bg-emerald-500/10 text-emerald-400 rounded-xl";
const inactiveClass =
  "text-slate-500 hover:bg-slate-800/40 hover:text-slate-200";

function DashboardSidebarClient({
  user,
  logout,
}: {
  user: User;
  logout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="fixed left-4 top-4 z-60 rounded-xl bg-slate-950 p-3 text-slate-200 shadow-lg lg:hidden"
      >
        {isOpen ? <X /> : <Menu />}
      </button>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <aside
        className={`fixed left-0 top-0 h-screen max-w-72 w-72 bg-slate-950/80 backdrop-blur-3xl flex flex-col p-6 gap-8 shadow-[20px_0_40px_rgba(0,0,0,0.4)] z-50 ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-black tracking-tighter text-emerald-500">
            BankOS
          </h1>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/50 font-semibold">
            Private Banking
          </p>
        </div>
        <nav className="flex flex-col gap-2" onClick={() => setIsOpen(false)}>
          <Link
            className={`flex items-center gap-3 px-4 py-3 ${pathname === "/dashboard" ? activeClass : inactiveClass}   font-semibold transition-all duration-300 ease-in-out active:scale-95`}
            href="/dashboard"
          >
            <LayoutDashboard className="material-symbols-outlined" />
            <span>Dashboard</span>
          </Link>
          <Link
            className={`flex items-center gap-3 px-4 py-3 ${pathname === "/transactions" ? activeClass : inactiveClass} transition-all duration-300 ease-in-out active:scale-95 `}
            href="/transactions"
          >
            <Receipt className="material-symbols-outlined" />
            <span>Transactions</span>
          </Link>
          <Link
            className={`flex items-center gap-3 px-4 py-3 ${pathname === "/accounts" ? activeClass : inactiveClass}  transition-all duration-300 ease-in-out active:scale-95 `}
            href="/accounts"
          >
            <Wallet className="material-symbols-outlined" />
            <span>Accounts</span>
          </Link>
          <Link
            className={`flex items-center gap-3 px-4 py-3 ${pathname === "/budgets" ? activeClass : inactiveClass}  transition-all duration-300 ease-in-out active:scale-95 `}
            href="/budgets"
          >
            <BadgeDollarSign className="material-symbols-outlined" />
            <span>Budgets</span>
          </Link>
          <Link
            className={`flex items-center gap-3 px-4 py-3 ${pathname === "/subscription" ? activeClass : inactiveClass}  transition-all duration-300 ease-in-out active:scale-95 `}
            href="/subscription"
          >
            <CalendarSync className="material-symbols-outlined" />
            <span>Subscription</span>
          </Link>
          <Link
            className={`flex items-center gap-3 px-4 py-3 ${pathname === "/setting-page" ? activeClass : inactiveClass}  transition-all duration-300 ease-in-out active:scale-95 `}
            href="/setting-page"
          >
            <Settings className="material-symbols-outlined" />
            <span>Settings</span>
          </Link>
        </nav>
        <div className="mt-auto">
          <div className="p-4 rounded-2xl bg-surface-container-low flex items-center gap-3">
            <CircleUserRound className="w-10 h-10 rounded-full object-cover grayscale opacity-80" />
            <p className="truncate text-sm font-medium text-on-surface-variant/70">
              {user?.email}
            </p>
          </div>
          <form action={() => logout()}>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-100"
            >
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

export default DashboardSidebarClient;
