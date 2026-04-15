import { getDashboardData } from "@/features/dashboard/actions";
import DashboardClient from "@/features/dashboard/components/DashboardClient";

export default async function DashBoard() {
  // fetch data on load:
  // in the future I will prevent from fetching every render, maybe cacheing or useMemo

  const data = await getDashboardData();
  return <DashboardClient initialValue={data} />;
}
