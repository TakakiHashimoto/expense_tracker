import {
  CircleUserRound,
  LayoutDashboard,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";

function DashboardSidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen max-w-72 w-72 bg-slate-950/80 backdrop-blur-3xl flex flex-col p-6 gap-8 shadow-[20px_0_40px_rgba(0,0,0,0.4)] z-50">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-black tracking-tighter text-emerald-500">
          Obsidian Ledger
        </h1>
        <p className="text-xs uppercase tracking-widest text-on-surface-variant/50 font-semibold">
          Private Banking
        </p>
      </div>
      <nav className="flex flex-col gap-2">
        <Link
          className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl font-semibold transition-all duration-300 ease-in-out active:scale-95"
          href="/dashboard"
        >
          <LayoutDashboard className="material-symbols-outlined" />
          <span>Dashboard</span>
        </Link>
        <Link
          className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-200 transition-all duration-300 ease-in-out active:scale-95 hover:bg-slate-800/40"
          href="#"
        >
          <Receipt className="material-symbols-outlined" />
          <span>Transactions</span>
        </Link>
        <Link
          className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-200 transition-all duration-300 ease-in-out active:scale-95 hover:bg-slate-800/40"
          href="#"
        >
          <Wallet className="material-symbols-outlined" />
          <span>Accounts</span>
        </Link>
        <Link
          className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-200 transition-all duration-300 ease-in-out active:scale-95 hover:bg-slate-800/40"
          href="#"
        >
          <Settings className="material-symbols-outlined" />
          <span>Settings</span>
        </Link>
      </nav>
      <div className="mt-auto">
        <div className="p-4 rounded-2xl bg-surface-container-low flex items-center gap-3">
          <CircleUserRound className="w-10 h-10 rounded-full object-cover grayscale opacity-80" />
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate">Elias Sterling</p>
            <p className="text-xs text-on-surface-variant truncate">
              Premium Member
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
