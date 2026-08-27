import { grabUser } from "@/features/dashboard/actions";
import { normalizeCategory } from "@/lib/transactions.helper";
import { SupabaseClient } from "@supabase/supabase-js";
import { RemovedTransaction, Transaction } from "plaid";

// take Plaid’s sync changes and apply those changes into your own database
export async function persistSyncResult(
  supabase: SupabaseClient,
  added: Transaction[],
  modified: Transaction[],
  removed: RemovedTransaction[],
  cursor: string | null,
  itemUuid: string,
) {
  try {
    const user = await grabUser(supabase);

    // Plaid uses positive = money out, negative = money in.
    // Our app uses negative = expense, positive = income.
    // Flip once at ingestion so the rest of the app has one consistent rule.
    function normalizeAmount(amount: number) {
      return -amount;
    }

    async function findOrCreateCategory(input: {
      userId: string;
      kind: "income" | "expense";
      name: string;
    }) {
      const { data, error } = await supabase
        .from("categories")
        .upsert(
          { user_id: input.userId, kind: input.kind, name: input.name },
          { onConflict: "user_id,kind,name" }, // prevent duplicate: (user_id:1, kind:expense, name:food)
        )
        .select("id")
        .single();

      if (error || !data) {
        throw new Error("Failed to find or create category");
      }

      return data.id;
    }

    // Here, I want to add "added" to a transaction DB.
    // ex) Takaki's TD and Takaki's TD's account.
    for (const item of added) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id")
        .match({
          plaid_account_id: item.account_id,
          plaid_item_id: itemUuid,
          user_id: user.id,
        })
        .single();

      if (error || !data) {
        throw new Error("Something went wrong while fetching accounts id");
      }

      const accountId = data.id;
      if (!accountId) throw new Error("Can't find an account");

      // normalize amount
      const normalizedAmount = normalizeAmount(item.amount);

      // normalize category

      const rowCategoryName = normalizeCategory({
        amount: normalizedAmount,
        rawCategory: item.personal_finance_category?.primary ?? "",
        merchantName: item.merchant_name ?? "",
        rawDetail: item.personal_finance_category?.detailed ?? "",
      });

      const categId = await findOrCreateCategory({
        kind: rowCategoryName.kind,
        name: rowCategoryName.name,
        userId: user.id,
      });

      const { error: addedError } = await supabase
        .from("transactions")
        .upsert(
          {
            user_id: user.id,
            account_id: accountId,
            category_id: categId,
            category_source: "auto",
            amount: normalizedAmount,
            merchant: item.merchant_name,
            plaid_transaction_id: item.transaction_id,
            plaid_item_id: itemUuid,
            pending: item.pending,
            posted_at: item.datetime ?? item.date,
            posted_date: item.date,
            posted_datetime: item.datetime,
            authorized_date: item.authorized_date,
            authorized_datetime: item.authorized_datetime,
            authorized_at: item.authorized_datetime ?? item.authorized_date,
            payment_channel: item.payment_channel,
            raw_category: item.personal_finance_category,
            plaid_account_id: item.account_id,
            name: item.name,
            location: item.location,
            is_removed: false,
          },
          { onConflict: "plaid_item_id,plaid_transaction_id" },
        );

      if (addedError) {
        throw new Error("Something went wrong");
      }
    }

    for (const item of modified) {
      const { data, error } = await supabase
        .from("accounts")
        .select("id")
        .match({
          plaid_account_id: item.account_id,
          plaid_item_id: itemUuid,
          user_id: user.id,
        })
        .single();

      if (error || !data) {
        throw new Error("Something went wrong while fetching accounts id");
      }

      const accountId = data.id;
      if (!accountId) throw new Error("Can't find an account");

      const normalizedAmount = normalizeAmount(item.amount);

      const categName = normalizeCategory({
        amount: normalizedAmount,
        rawCategory: item.personal_finance_category?.primary ?? "",
        rawDetail: item.personal_finance_category?.detailed ?? "",
        merchantName: item.merchant_name ?? "",
      });

      // insert category
      const categId = await findOrCreateCategory({
        name: categName.name,
        kind: categName.kind,
        userId: user.id,
      });

      // if category is manually modified by user, keep that category
      const { data: existingTransaction, error: existingTransactionError } =
        await supabase
          .from("transactions")
          .select("category_id, category_source")
          .eq("user_id", user.id)
          .eq("plaid_item_id", itemUuid)
          .eq("plaid_transaction_id", item.transaction_id)
          .maybeSingle();

      if (existingTransactionError) {
        throw new Error("Failed to check existing transaction category");
      }

      const shouldUpdateCategory =
        !existingTransaction ||
        existingTransaction.category_source !== "manual";

      const categoryFields = shouldUpdateCategory
        ? { category_id: categId, category_source: "auto" }
        : {};

      // upsert is to add if new and update if already exists. ==> the way to know is to have constraints in db
      const { error: modifiedError } = await supabase
        .from("transactions")
        .upsert(
          {
            user_id: user.id,
            account_id: accountId,
            ...categoryFields,
            posted_at: item.datetime ?? item.date,
            amount: normalizedAmount,
            merchant: item.merchant_name,
            plaid_transaction_id: item.transaction_id,
            plaid_item_id: itemUuid,
            pending: item.pending,
            posted_date: item.date,
            posted_datetime: item.datetime,
            authorized_date: item.authorized_date,
            authorized_datetime: item.authorized_datetime,
            authorized_at: item.authorized_datetime ?? item.authorized_date,
            name: item.name,
            payment_channel: item.payment_channel,
            raw_category: item.personal_finance_category,
            plaid_account_id: item.account_id,
            location: item.location,
            is_removed: false,
          },
          { onConflict: "plaid_item_id,plaid_transaction_id" },
        );

      if (modifiedError) {
        throw new Error("Failed to add modified"); // this message is temporary filler
      }
    }

    // Here, I want to mark "removed" an item that matches with
    // find account with this Plaid account id that belongs to this linked item
    for (const item of removed) {
      const { error: removedError } = await supabase
        .from("transactions")
        .update({ is_removed: true })
        .match({
          user_id: user.id,
          plaid_transaction_id: item.transaction_id,
          plaid_item_id: itemUuid,
        });

      if (removedError) {
        throw new Error("Failed to add removed");
      }
    }

    // update plaid_items
    const completedAt = new Date().toISOString();
    const { data: updatedItem, error: updateError } = await supabase
      .from("plaid_items")
      .update({
        transactions_cursor: cursor,
        status: "active",
        last_sync_status: "succeeded",
        last_sync_error: null,
        last_sync_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", itemUuid)
      .eq("user_id", user.id)
      .select("id")
      .single();

    if (updateError || !updatedItem) {
      throw new Error("Failed to save successful sync state", {
        cause: updateError,
      });
    }

    return { success: true, message: "Successfully updated database" };
  } catch (e) {
    console.error("Failed to persist plaid sync result", e);
    throw new Error("Failed to persist Plaind sync result");
  }
}
