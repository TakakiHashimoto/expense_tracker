"use server";

import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateTransactionCategory({
  transactionId,
  categoryId,
}: {
  transactionId: string;
  categoryId: string;
}) {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  if (categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (categoryError || !category) {
      throw new Error("Invalid category");
    }
  }

  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("user_id", user.id)
    .eq("id", transactionId)
    .eq("is_removed", false);

  if (error) {
    throw new Error("Failed to update transaction category");
  }

  revalidatePath(`/transactions/${transactionId}`);
  return { ok: true };
}
