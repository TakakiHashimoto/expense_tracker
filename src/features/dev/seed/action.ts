"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function seedData() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("only executable on development mode");
  }
  const supabase = await createClient();

  const postedDate = "2026-02-09";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error: delTransactionErr } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", user.id);
  const { error: delCategErr } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", user.id);
  const { error: delAccountErr } = await supabase
    .from("accounts")
    .delete()
    .eq("user_id", user.id);
  if (delTransactionErr) {
    throw new Error(delTransactionErr.message);
  }
  if (delCategErr) {
    throw new Error(delCategErr.message);
  }
  if (delAccountErr) {
    throw new Error(delAccountErr.message);
  }

  const { data: accountId, error: accountError } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      type: "Credit Card",
      name: "TD bank",
      currency: "CAD",
    })
    .select("id")
    .single();

  if (accountError || !accountId) {
    throw new Error(accountError.message);
  }

  const { data: categId, error: categError } = await supabase
    .from("categories")
    .insert({ user_id: user.id, kind: "expense", name: "Food" })
    .select("id")
    .single();

  if (categError || !categId) {
    throw new Error(categError.message);
  }

  const { data: transactionId, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: accountId.id,
      category_id: categId.id,
      amount: -40,
      merchant: "save on foods",
      posted_date: postedDate,
      posted_datetime: null,

      // temporary compatibility only
    })
    .select("id")
    .single();

  if (transactionError || !transactionId) {
    throw new Error(transactionError.message);
  }

  redirect("/dashboard");
}
