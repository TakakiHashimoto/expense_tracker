import { logoutUser } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebarClient from "./DashboardSidebarClient";

async function DashboardSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User is not found");
  }

  return <DashboardSidebarClient user={user} logout={logoutUser} />;
}

export default DashboardSidebar;
