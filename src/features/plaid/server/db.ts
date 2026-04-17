import { getUser } from "@/features/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import { RemovedTransaction, Transaction } from "plaid";

export async function persistSyncResult(
  added: Transaction[],
  modified: Transaction[],
  removed: RemovedTransaction[],
  cursor: string | null,
  itemUuid: string,
) {
  const supabase = await createClient();
  const user = await getUser(supabase);

  for (const item of added) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id")
      .eq("plaid_account_id", item.account_id);
    // const categoryId = await supabase
    //   .from("categories")
    //   .select("id")
    //   .or(
    //     `raw_category->>primary.eq.${item.personal_finance_category?.primary}, raw_category->>detailed.eq.${item.personal_finance_category?.detailed}`,
    //   );

    if (error) {
      throw new Error("Something went wrong while fetching accounts id");
    }
    const { error: addedError } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: data?.[0].id,
      category_id: null,
      posted_at: item.datetime ?? item.date,
      amount: item.amount,
      merchant: item.merchant_name,
      plaid_transaction_id: item.transaction_id,
      plaid_item_id: itemUuid, // How do I get hold of plaid_id? Maybe it is a foreign key so I don't necessarily put here
      pending: item.pending,
      authorized_at: item.authorized_datetime ?? item.authorized_date,
      payment_channel: item.payment_channel,
      raw_category: item.personal_finance_category,
      plaid_account_id: item.account_id,
      location: item.location,
    });

    if (addedError) {
      throw new Error("Something went wrong");
    }
  }

  for (const item of modified) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id")
      .eq("plaid_account_id", item.account_id);
    // const categoryId = await supabase
    //   .from("categories")
    //   .select("id")
    //   .or(
    //     `raw_category->>primary.eq.${item.personal_finance_category?.primary}, raw_category->>detailed.eq.${item.personal_finance_category?.detailed}`,
    //   );

    if (error) {
      throw new Error("Something went wrong"); // Thhis message is temporary filler
    }
    const { error: modifiedError } = await supabase
      .from("transactions")
      .upsert({
        user_id: user.id,
        account_id: data?.[0].id,
        category_id: null,
        posted_at: item.datetime ?? item.date,
        amount: item.amount,
        merchant: item.merchant_name,
        plaid_transaction_id: item.transaction_id,
        plaid_item_id: itemUuid, // How do I get hold of plaid_id? Maybe it is a foreign key so I don't necessarily put here
        pending: item.pending,
        authorized_at: item.authorized_datetime ?? item.authorized_date,
        payment_channel: item.payment_channel,
        raw_category: item.personal_finance_category,
        plaid_account_id: item.account_id,
        location: item.location,
      });

    if (modifiedError) {
      throw new Error("Something went wrong"); // this message is temporary filler
    }
  }

  for (const item of removed) {
    const { error: removedError } = await supabase
      .from("transactions")
      .delete()
      .eq("plaid_transaction_id", item.transaction_id);

    if (removedError) {
      throw new Error("something went wrong");
    }
  }

  const { error: cursorError } = await supabase
    .from("plaid_items")
    .update({ transactions_cursor: cursor })
    .eq("id", itemUuid); // What should it be equal?

  if (cursorError) {
    throw new Error("Something went wrong while updating cursor");
  }

  return { success: true, message: "Successfully updated database" };
}

// information you need for transactions database:
// id	uuid
// user_id	uuid
// account_id	uuid
// category_id	uuid
// posted_at timestamp with time zone
// amount	numeric
// merchant	text
// note	text
// created_at	timestamp with time zone
// plaid_transaction_id	text
// plaid_item_id	uuid
// pending	boolean
// authorized_at	timestamp with time zone
// name	text
// payment_channel text
// raw_category	jsonb
// plaid_account_id	text
// is_removed	boolean
// location	jsonb

// "removed": [
//     {
//       "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
//       "transaction_id": "CmdQTNgems8BT1B7ibkoUXVPyAeehT3Tmzk0l"
//     }
//   ]

//   "added": [
//     {
//       "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
//       "account_owner": null,
//       "amount": 72.1,
//       "iso_currency_code": "USD",
//       "unofficial_currency_code": null,
//       "check_number": null,
//       "counterparties": [
//         {
//           "name": "Walmart",
//           "type": "merchant",
//           "logo_url": "https://plaid-merchant-logos.plaid.com/walmart_1100.png",
//           "website": "walmart.com",
//           "entity_id": "O5W5j4dN9OR3E6ypQmjdkWZZRoXEzVMz2ByWM",
//           "confidence_level": "VERY_HIGH"
//         }
//       ],
//       "date": "2023-09-24",
//       "datetime": "2023-09-24T11:01:01Z",
//       "authorized_date": "2023-09-22",
//       "authorized_datetime": "2023-09-22T10:34:50Z",
//       "location": {
//         "address": "13425 Community Rd",
//         "city": "Poway",
//         "region": "CA",
//         "postal_code": "92064",
//         "country": "US",
//         "lat": 32.959068,
//         "lon": -117.037666,
//         "store_number": "1700"
//       },
//       "name": "PURCHASE WM SUPERCENTER #1700",
//       "merchant_name": "Walmart",
//       "merchant_entity_id": "O5W5j4dN9OR3E6ypQmjdkWZZRoXEzVMz2ByWM",
//       "logo_url": "https://plaid-merchant-logos.plaid.com/walmart_1100.png",
//       "website": "walmart.com",
//       "payment_meta": {
//         "by_order_of": null,
//         "payee": null,
//         "payer": null,
//         "payment_method": null,
//         "payment_processor": null,
//         "ppd_id": null,
//         "reason": null,
//         "reference_number": null
//       },
//       "payment_channel": "in store",
//       "pending": false,
//       "pending_transaction_id": "no86Eox18VHMvaOVL7gPUM9ap3aR1LsAVZ5nc",
//       "personal_finance_category": {
//         "primary": "GENERAL_MERCHANDISE",
//         "detailed": "GENERAL_MERCHANDISE_SUPERSTORES",
//         "confidence_level": "VERY_HIGH"
//       },
//       "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
//       "transaction_id": "lPNjeW1nR6CDn5okmGQ6hEpMo4lLNoSrzqDje",
//       "transaction_code": null,
//       "transaction_type": "place"
//     }
//   ],
//   "modified": [
//     {
//       "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
//       "account_owner": null,
//       "amount": 28.34,
//       "iso_currency_code": "USD",
//       "unofficial_currency_code": null,
//       "check_number": null,
//       "counterparties": [
//         {
//           "name": "DoorDash",
//           "type": "marketplace",
//           "logo_url": "https://plaid-counterparty-logos.plaid.com/doordash_1.png",
//           "website": "doordash.com",
//           "entity_id": "YNRJg5o2djJLv52nBA1Yn1KpL858egYVo4dpm",
//           "confidence_level": "HIGH"
//         },
//         {
//           "name": "Burger King",
//           "type": "merchant",
//           "logo_url": "https://plaid-merchant-logos.plaid.com/burger_king_155.png",
//           "website": "burgerking.com",
//           "entity_id": "mVrw538wamwdm22mK8jqpp7qd5br0eeV9o4a1",
//           "confidence_level": "VERY_HIGH"
//         }
//       ],
//       "date": "2023-09-28",
//       "datetime": "2023-09-28T15:10:09Z",
//       "authorized_date": "2023-09-27",
//       "authorized_datetime": "2023-09-27T08:01:58Z",
//       "location": {
//         "address": null,
//         "city": null,
//         "region": null,
//         "postal_code": null,
//         "country": null,
//         "lat": null,
//         "lon": null,
//         "store_number": null
//       },
//       "name": "Dd Doordash Burgerkin",
//       "merchant_name": "Burger King",
//       "merchant_entity_id": "mVrw538wamwdm22mK8jqpp7qd5br0eeV9o4a1",
//       "logo_url": "https://plaid-merchant-logos.plaid.com/burger_king_155.png",
//       "website": "burgerking.com",
//       "payment_meta": {
//         "by_order_of": null,
//         "payee": null,
//         "payer": null,
//         "payment_method": null,
//         "payment_processor": null,
//         "ppd_id": null,
//         "reason": null,
//         "reference_number": null
//       },
//       "payment_channel": "online",
//       "pending": true,
//       "pending_transaction_id": null,
//       "personal_finance_category": {
//         "primary": "FOOD_AND_DRINK",
//         "detailed": "FOOD_AND_DRINK_FAST_FOOD",
//         "confidence_level": "VERY_HIGH"
//       },
//       "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_FOOD_AND_DRINK.png",
//       "transaction_id": "yhnUVvtcGGcCKU0bcz8PDQr5ZUxUXebUvbKC0",
//       "transaction_code": null,
//       "transaction_type": "digital"
//     }
//   ],

export async function getPlaidItemId() {
  const supabase = await createClient();
}

export async function getAccessToken() {}
