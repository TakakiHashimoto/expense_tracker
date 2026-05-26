import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConnectBankClient from "@/components/connectBank/ConnectBankClient";

export default async function ConnectBankPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plaidItems, error } = await supabase
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (error) {
    throw new Error("Failed to check connected bank status");
  }

  const hasConnectedBank = (plaidItems ?? []).length > 0;

  if (hasConnectedBank) {
    redirect("/dashboard");
  }

  return <ConnectBankClient />;
}
