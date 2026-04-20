"use server";

import { createClient } from "@/lib/supabase/server";
import { grabUser } from "../dashboard/actions";

async function getUserOnboardingState() {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const { data, error } = await supabase
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: "Failed to fetch Plaid Items for this user" };
  }

  return { ok: true, hasPlaidItems: data.length > 0 };
}

export { getUserOnboardingState };
