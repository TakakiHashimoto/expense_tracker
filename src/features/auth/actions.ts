"use server";

import { createClient } from "@/lib/supabase/server";
import { grabUser } from "../dashboard/actions";

type OnboardingState =
  | { ok: true; hasPlaidItems: boolean }
  | { ok: false; error: string };

async function getUserOnboardingState() {
  const supabase = await createClient();

  try {
    const user = await grabUser(supabase);
    const { count, error } = await supabase
      .from("plaid_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) {
      return { ok: false, error: "Failed to fetch Plaid Items for this user" };
    }

    return { ok: true, hasPlaidItems: (count ?? 0) > 0 };
  } catch (e) {
    console.log(e);
    return { ok: false, error: "User is not authenticated" };
  }
}

export { getUserOnboardingState };
