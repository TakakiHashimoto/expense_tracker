import SyncDashboardButton from "./SyncDashboardButton";
import ConnectButtonComponent from "@/components/connectBank/ConnectButtonComponent";

function DashboardHeader() {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <h1 className="text-3xl font-bold tracking-tight text-slate-100">
        Dashboard
      </h1>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ConnectButtonComponent title="Add Bank" />
        <SyncDashboardButton />
      </div>
    </header>
  );
}

export default DashboardHeader;
