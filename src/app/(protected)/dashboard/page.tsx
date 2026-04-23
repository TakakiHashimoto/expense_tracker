import { getDashboardData } from "@/features/dashboard/actions";
import DashboardClient from "@/features/dashboard/components/DashboardClient";
import { DashboardData } from "@/features/dashboard/type";

export default async function Dashboard() {
  const data: DashboardData = await getDashboardData();
  return <DashboardClient initialValue={data} />;
}
