import SyncDashboardButton from "./SyncDashboardButton";

function DashboardHeader() {
  return (
    <header className="fixed top-0 right-0 left-72 h-24 bg-slate-950/40 backdrop-blur-md flex justify-between items-center px-12 z-40">
      <h1 className="text-3xl font-bold tracking-tight text-slate-100">
        Dashboard
      </h1>
      <div className="flex items-center gap-6">
        <SyncDashboardButton />
      </div>
    </header>
  );
}

export default DashboardHeader;
