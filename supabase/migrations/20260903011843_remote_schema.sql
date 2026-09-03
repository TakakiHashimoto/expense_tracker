SET local check_function_bodies = off;

CREATE TABLE "public"."accounts" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           uuid                     NOT NULL,
  "type"              text                     NOT NULL,
  "name"              text                     NOT NULL,
  "currency"          text                     NOT NULL DEFAULT 'CAD'::text,
  "is_active"         boolean                  NOT NULL DEFAULT true,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "plaid_item_id"     uuid,
  "plaid_account_id"  text,
  "mask"              text,
  "official_name"     text,
  "subtype"           text,
  "current_balance"   numeric,
  "available_balance" numeric,
  "balance_as_of"     timestamp with time zone,
  CONSTRAINT "accounts_id_plaid_item_id_unique" UNIQUE (id, plaid_item_id),
  CONSTRAINT "accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "accounts_plaid_item_id_plaid_account_id_unique" UNIQUE (plaid_item_id, plaid_account_id),
  CONSTRAINT "accounts_user_id_id_unique" UNIQUE (user_id, id)
);

ALTER TABLE "public"."accounts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."budgets" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "category_id" uuid                     NOT NULL,
  "month"       date                     NOT NULL,
  "amount"      numeric(12,2)            NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "budgets_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "budgets_pkey" PRIMARY KEY (id),
  CONSTRAINT "budgets_user_category_month_unique" UNIQUE (user_id, category_id, month)
);

ALTER TABLE "public"."budgets"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."categories" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "kind"         text                     NOT NULL,
  "name"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "is_active"    boolean                  NOT NULL DEFAULT true,
  "raw_category" jsonb,
  CONSTRAINT "categories_kind_check" CHECK ((kind = ANY (ARRAY['expense'::text, 'income'::text]))),
  CONSTRAINT "categories_pkey" PRIMARY KEY (id),
  CONSTRAINT "unique_categories_user_kind_name" UNIQUE (user_id, kind, name)
);

ALTER TABLE "public"."categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."plaid_item_secrets" (
  "plaid_item_id" uuid                     NOT NULL,
  "access_token"  text                     NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "plaid_item_secrets_pkey" PRIMARY KEY (plaid_item_id)
);

ALTER TABLE "public"."plaid_item_secrets"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."plaid_items" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             uuid                     NOT NULL,
  "plaid_item_id"       text                     NOT NULL,
  "institution_id"      text,
  "institution_name"    text,
  "status"              text                     NOT NULL DEFAULT 'active'::text,
  "transactions_cursor" text,
  "last_sync_at"        timestamp with time zone,
  "last_sync_status"    text,
  "last_sync_error"     text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone DEFAULT now(),
  CONSTRAINT "plaid_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "plaid_items_plaid_item_id_key" UNIQUE (plaid_item_id),
  CONSTRAINT "plaid_items_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'error'::text, 'revoked'::text]))),
  CONSTRAINT "plaid_items_user_id_id_unique" UNIQUE (user_id, id)
);

ALTER TABLE "public"."plaid_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."transactions" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"              uuid                     NOT NULL,
  "account_id"           uuid                     NOT NULL,
  "category_id"          uuid,
  "amount"               numeric(12,2)            NOT NULL,
  "merchant"             text,
  "note"                 text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "plaid_transaction_id" text,
  "plaid_item_id"        uuid,
  "pending"              boolean                  NOT NULL DEFAULT false,
  "name"                 text,
  "payment_channel"      text,
  "raw_category"         jsonb,
  "plaid_account_id"     text,
  "is_removed"           boolean                  NOT NULL DEFAULT false,
  "location"             jsonb,
  "category_source"      text                     NOT NULL DEFAULT 'auto'::text,
  "posted_date"          date                     NOT NULL,
  "posted_datetime"      timestamp with time zone,
  "authorized_date"      date,
  "authorized_datetime"  timestamp with time zone,
  CONSTRAINT "transactions_category_source_check" CHECK ((category_source = ANY (ARRAY['auto'::text, 'manual'::text]))),
  CONSTRAINT "transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "unique_plaid_item_id_plaid_transaction_id" UNIQUE (plaid_item_id, plaid_transaction_id),
  CONSTRAINT "unique_plaid_transaction_id" UNIQUE (plaid_transaction_id)
);

ALTER TABLE "public"."transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_daily_expenses (
  target_date date
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  AS $function$
  SELECT COALESCE(SUM(t.amount), 0)
  FROM public.transactions AS t
  WHERE t.user_id = auth.uid()
    AND t.amount < 0
    AND t.posted_date = target_date
    AND (t.is_removed IS NULL OR t.is_removed = false);
$function$;

CREATE OR REPLACE FUNCTION public.get_monthly_expense_total (
  start_date date,
  end_date   date
)
  RETURNS numeric
  LANGUAGE sql
  STABLE
  AS $function$
  SELECT COALESCE(SUM(t.amount), 0)
  FROM public.transactions AS t
  WHERE t.user_id = auth.uid()
    AND t.amount < 0
    AND t.posted_date >= start_date
    AND t.posted_date < end_date
    AND (t.is_removed IS NULL OR t.is_removed = false);
$function$;

ALTER TABLE "public"."accounts"
  ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."budgets"
  ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."budgets"
  ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE "public"."categories"
  ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."accounts"
  ADD CONSTRAINT "accounts_plaid_item_id_fkey" FOREIGN KEY (plaid_item_id) REFERENCES public.plaid_items(id);

ALTER TABLE "public"."plaid_item_secrets"
  ADD CONSTRAINT "plaid_item_secrets_plaid_item_id_fkey" FOREIGN KEY (plaid_item_id) REFERENCES public.plaid_items(id) ON DELETE CASCADE;

ALTER TABLE "public"."plaid_items"
  ADD CONSTRAINT "plaid_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."accounts"
  ADD CONSTRAINT "accounts_user_id_plaid_item_id_fkey" FOREIGN KEY (user_id, plaid_item_id) REFERENCES public.plaid_items(user_id, id);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_account_id_plaid_item_id_fkey" FOREIGN KEY (account_id, plaid_item_id) REFERENCES public.accounts(id, plaid_item_id);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_plaid_item_id_fkey" FOREIGN KEY (plaid_item_id) REFERENCES public.plaid_items(id);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_user_id_account_id_fkey" FOREIGN KEY (user_id, account_id) REFERENCES public.accounts(user_id, id);

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_user_id_plaid_item_id_fkey" FOREIGN KEY (user_id, plaid_item_id) REFERENCES public.plaid_items(user_id, id);

CREATE INDEX accounts_plaid_item_id_idx ON public.accounts USING btree (plaid_item_id);

CREATE UNIQUE INDEX category_user_kind_name ON public.categories USING btree (user_id, kind, name);

CREATE INDEX plaid_items_user_id_idx ON public.plaid_items USING btree (user_id);

CREATE INDEX transactions_account_posted_date ON public.transactions USING btree (account_id, posted_date DESC);

CREATE INDEX transactions_category_id ON public.transactions USING btree (category_id);

CREATE INDEX transactions_user_posted_date ON public.transactions USING btree (user_id, posted_date DESC);

CREATE POLICY "accounts_delete_own" ON "public"."accounts"
  FOR DELETE
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "accounts_insert_own" ON "public"."accounts"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "accounts_select_own" ON "public"."accounts"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "accounts_update_own" ON "public"."accounts"
  FOR UPDATE
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can create their own budgets" ON "public"."budgets"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = budgets.category_id) AND (c.user_id = auth.uid()))))));

CREATE POLICY "Users can delete their own budgets" ON "public"."budgets"
  FOR DELETE
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can read their own budgets" ON "public"."budgets"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update their own budgets" ON "public"."budgets"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = budgets.category_id) AND (c.user_id = auth.uid()))))));

CREATE POLICY "category_delete_own" ON "public"."categories"
  FOR DELETE
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "category_insert_own" ON "public"."categories"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "category_select_own" ON "public"."categories"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "category_update_own" ON "public"."categories"
  FOR UPDATE
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "plaid_item_select_own" ON "public"."plaid_items"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "plaid_items_delete_own" ON "public"."plaid_items"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "plaid_items_insert_own" ON "public"."plaid_items"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "plaid_items_update_own" ON "public"."plaid_items"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "transactions_delete_own" ON "public"."transactions"
  FOR DELETE
  TO PUBLIC
  USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.accounts a
  WHERE ((a.id = transactions.account_id) AND (a.user_id = auth.uid())))) AND ((category_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = transactions.category_id) AND (c.user_id = auth.uid())))))));

CREATE POLICY "transactions_insert_own" ON "public"."transactions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.accounts a
  WHERE ((a.id = transactions.account_id) AND (a.user_id = auth.uid())))) AND ((category_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = transactions.category_id) AND (c.user_id = auth.uid())))))));

CREATE POLICY "transactions_select_own" ON "public"."transactions"
  FOR SELECT
  TO PUBLIC
  USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.accounts a
  WHERE ((a.id = transactions.account_id) AND (a.user_id = auth.uid())))) AND ((category_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = transactions.category_id) AND (c.user_id = auth.uid())))))));

CREATE POLICY "transactions_update_own" ON "public"."transactions"
  FOR UPDATE
  TO PUBLIC
  USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.accounts a
  WHERE ((a.id = transactions.account_id) AND (a.user_id = auth.uid())))) AND ((category_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = transactions.category_id) AND (c.user_id = auth.uid())))))))
  WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.accounts a
  WHERE ((a.id = transactions.account_id) AND (a.user_id = auth.uid())))) AND ((category_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.categories c
  WHERE ((c.id = transactions.category_id) AND (c.user_id = auth.uid())))))));

GRANT EXECUTE ON FUNCTION "public"."get_daily_expenses"(date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_monthly_expense_total"(date, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."accounts" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."accounts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."accounts" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."budgets" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."budgets" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."budgets" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."categories" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."categories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plaid_item_secrets" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."plaid_items" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."plaid_items" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."plaid_items" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."transactions" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON TABLE "public"."transactions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "postgres", "service_role";

