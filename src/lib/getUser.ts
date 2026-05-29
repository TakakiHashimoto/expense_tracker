import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export async function grabUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(); // getting a user using JWT

  if (error) {
    throw new Error("User not found");
  }
  if (!user) {
    redirect("/login");
  }

  return user;
}
