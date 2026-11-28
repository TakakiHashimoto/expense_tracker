-- Explicit provider relationships only; no historical/fuzzy backfill.
ALTER TABLE public.transactions
  ADD COLUMN plaid_pending_transaction_id text,
  ADD COLUMN plaid_pending_reconciled_at timestamptz;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_pending_reference_check
CHECK (plaid_pending_transaction_id IS NULL OR (
  pending = false AND plaid_item_id IS NOT NULL
  AND plaid_transaction_id IS NOT NULL AND plaid_transaction_id ~ '[^[:space:]]'
  AND plaid_pending_transaction_id ~ '[^[:space:]]'
  AND plaid_pending_transaction_id <> plaid_transaction_id
));
ALTER TABLE public.transactions ADD CONSTRAINT transactions_pending_reconciled_check
CHECK (plaid_pending_reconciled_at IS NULL OR plaid_pending_transaction_id IS NOT NULL);

-- Item+reference also detects ambiguity before the pending row exists.
CREATE INDEX transactions_pending_reference_idx
ON public.transactions (plaid_item_id, plaid_pending_transaction_id)
WHERE plaid_pending_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.transactions.plaid_pending_reconciled_at IS
'First matching pending row reconciliation. Metadata transfer is one-shot; the immutable provider reference suppresses pending replay even after successor removal.';

-- All transaction/category writes and the cursor advance belong to ONE RPC request.
-- This assumes the Phase 2 migration has already added the sync lease columns.

CREATE OR REPLACE FUNCTION public.commit_plaid_sync(
  p_user_id uuid,
  p_item_id uuid,
  p_lease_token uuid,
  p_expected_cursor text,
  p_next_cursor text,
  p_added jsonb,
  p_modified jsonb,
  p_removed jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cursor text;
  v_token uuid;
  v_expiry timestamptz;
  v_item_status text;
  v_tx jsonb;
  v_removed jsonb;
  v_account_id uuid;
  v_category_id uuid;
  v_transaction_id uuid;
  v_updated_count bigint;
  v_reference text;
  v_keys text[];
  v_existing public.transactions%ROWTYPE;
  v_pending public.transactions%ROWTYPE;
  v_posted public.transactions%ROWTYPE;
  v_new_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_user_id IS NULL OR p_item_id IS NULL OR p_lease_token IS NULL THEN
    RAISE EXCEPTION 'Missing sync identity or lease token';
  END IF;

  IF p_next_cursor IS NULL THEN
    RAISE EXCEPTION 'Final sync cursor must not be null';
  END IF;

  IF p_added IS NULL OR jsonb_typeof(p_added) <> 'array'
     OR p_modified IS NULL OR jsonb_typeof(p_modified) <> 'array'
     OR p_removed IS NULL OR jsonb_typeof(p_removed) <> 'array'
  THEN
    RAISE EXCEPTION 'Invalid sync payload: expected JSON arrays';
  END IF;

  -- The row lock serializes this commit with competing lease acquisition.
  SELECT i.transactions_cursor,
         i.sync_lock_token,
         i.sync_lock_expires_at,
         i.status
    INTO v_cursor, v_token, v_expiry, v_item_status
    FROM public.plaid_items AS i
   WHERE i.id = p_item_id
     AND i.user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plaid Item not found';
  END IF;

  IF v_token IS DISTINCT FROM p_lease_token
     OR v_expiry IS NULL
     OR v_expiry <= clock_timestamp()
  THEN
    RAISE EXCEPTION 'Sync lease is no longer valid';
  END IF;

  -- Plaid cursors are opaque tokens, not ordered numbers.
  IF v_cursor IS DISTINCT FROM p_expected_cursor THEN
    RAISE EXCEPTION 'Sync cursor changed';
  END IF;

  -- A revoked Item must not be reactivated by a concurrent sync commit.
  IF v_item_status = 'revoked' THEN
    RAISE EXCEPTION 'Cannot sync a revoked Plaid Item';
  END IF;

  -- Bound reconciliation to touched provider IDs, incoming references, and the
  -- persisted references of touched successors (including old-client payloads).
  SELECT COALESCE(array_agg(DISTINCT k), ARRAY[]::text[]) INTO v_keys
  FROM (
    SELECT e->>'transaction_id' AS k
      FROM jsonb_array_elements(p_added || p_modified || p_removed) e
    UNION ALL
    SELECT e->>'pending_transaction_id'
      FROM jsonb_array_elements(p_added || p_modified) e
    UNION ALL
    SELECT t.plaid_pending_transaction_id FROM public.transactions t
     WHERE t.plaid_item_id = p_item_id AND t.user_id = p_user_id
       AND t.plaid_transaction_id IN (
         SELECT e->>'transaction_id'
         FROM jsonb_array_elements(p_added || p_modified || p_removed) e)
  ) keys WHERE k IS NOT NULL;

  -- The Item lock serializes provider writes. Lock existing affected rows in
  -- UUID order BEFORE reading metadata, including successors of replayed IDs.
  PERFORM t.id FROM public.transactions t
   WHERE t.user_id = p_user_id AND t.plaid_item_id = p_item_id
     AND (t.plaid_transaction_id = ANY(v_keys)
          OR t.plaid_pending_transaction_id = ANY(v_keys))
   ORDER BY t.id FOR UPDATE;

  -- Process both added and modified using the same replay-safe rules.
  -- p_added || p_modified preserves added-before-modified ordering.
  FOR v_tx IN
    SELECT e.value
      FROM jsonb_array_elements(p_added || p_modified) AS e(value)
  LOOP
    IF jsonb_typeof(v_tx) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_tx->'transaction_id') IS DISTINCT FROM 'string'
       OR COALESCE(v_tx->>'transaction_id', '') !~ '[^[:space:]]'
       OR NULLIF(btrim(v_tx->>'account_id'), '') IS NULL
       OR jsonb_typeof(v_tx->'amount') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_tx->'pending') IS DISTINCT FROM 'boolean'
       OR NULLIF(btrim(v_tx->>'posted_date'), '') IS NULL
       OR COALESCE(v_tx->>'category_kind', '') NOT IN ('income', 'expense')
       OR NULLIF(btrim(v_tx->>'category_name'), '') IS NULL
    THEN
      RAISE EXCEPTION 'Invalid transaction in sync payload';
    END IF;

    v_reference := v_tx->>'pending_transaction_id';
    IF v_reference IS NOT NULL AND (
      jsonb_typeof(v_tx->'pending_transaction_id') IS DISTINCT FROM 'string'
      OR v_reference !~ '[^[:space:]]'
      OR v_reference = v_tx->>'transaction_id'
      OR (v_tx->>'pending')::boolean
    ) THEN
      RAISE EXCEPTION 'Invalid pending transaction reference';
    END IF;

    SELECT a.id
      INTO v_account_id
      FROM public.accounts AS a
     WHERE a.plaid_account_id = v_tx->>'account_id'
       AND a.plaid_item_id = p_item_id
       AND a.user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plaid account not found for synced transaction';
    END IF;

    SELECT * INTO v_existing FROM public.transactions t
     WHERE t.plaid_transaction_id = v_tx->>'transaction_id';
    IF FOUND THEN
      IF v_existing.user_id <> p_user_id
         OR v_existing.plaid_item_id IS DISTINCT FROM p_item_id
         OR v_existing.account_id <> v_account_id THEN
        RAISE EXCEPTION 'Conflicting transaction identity';
      END IF;
      IF v_existing.plaid_pending_transaction_id IS NOT NULL AND (
        (v_reference IS NOT NULL AND v_reference <> v_existing.plaid_pending_transaction_id)
        OR (v_tx->>'pending')::boolean
      ) THEN
        RAISE EXCEPTION 'Conflicting pending transaction reference';
      END IF;
    END IF;

    -- Category creation participates in the same transaction as the transaction row.
    INSERT INTO public.categories (user_id, kind, name)
    VALUES (
      p_user_id,
      v_tx->>'category_kind',
      btrim(v_tx->>'category_name')
    )
    ON CONFLICT (user_id, kind, name)
    DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_category_id;

    INSERT INTO public.transactions AS t (
      user_id,
      account_id,
      category_id,
      category_source,
      amount,
      merchant,
      plaid_transaction_id,
      plaid_pending_transaction_id,
      plaid_item_id,
      pending,
      posted_date,
      posted_datetime,
      authorized_date,
      authorized_datetime,
      payment_channel,
      raw_category,
      plaid_account_id,
      name,
      location,
      is_removed
    )
    VALUES (
      p_user_id,
      v_account_id,
      v_category_id,
      'auto',
      (v_tx->>'amount')::numeric,
      v_tx->>'merchant',
      v_tx->>'transaction_id',
      v_reference,
      p_item_id,
      (v_tx->>'pending')::boolean,
      (v_tx->>'posted_date')::date,
      NULLIF(v_tx->>'posted_datetime', '')::timestamptz,
      NULLIF(v_tx->>'authorized_date', '')::date,
      NULLIF(v_tx->>'authorized_datetime', '')::timestamptz,
      v_tx->>'payment_channel',
      NULLIF(v_tx->'raw_category', 'null'::jsonb),
      v_tx->>'account_id',
      v_tx->>'name',
      NULLIF(v_tx->'location', 'null'::jsonb),
      false
    )
    ON CONFLICT (plaid_item_id, plaid_transaction_id)
    DO UPDATE SET
      plaid_pending_transaction_id = COALESCE(t.plaid_pending_transaction_id, EXCLUDED.plaid_pending_transaction_id),
      account_id = EXCLUDED.account_id,
      amount = EXCLUDED.amount,
      merchant = EXCLUDED.merchant,
      pending = EXCLUDED.pending,
      posted_date = EXCLUDED.posted_date,
      posted_datetime = EXCLUDED.posted_datetime,
      authorized_date = EXCLUDED.authorized_date,
      authorized_datetime = EXCLUDED.authorized_datetime,
      payment_channel = EXCLUDED.payment_channel,
      raw_category = EXCLUDED.raw_category,
      plaid_account_id = EXCLUDED.plaid_account_id,
      name = EXCLUDED.name,
      location = EXCLUDED.location,
      is_removed = false,
      category_id = CASE
        WHEN t.category_source = 'manual' THEN t.category_id
        ELSE EXCLUDED.category_id
      END,
      category_source = CASE
        WHEN t.category_source = 'manual' THEN 'manual'
        ELSE 'auto'
      END
    RETURNING id INTO v_transaction_id;

    IF v_transaction_id IS NULL THEN
      RAISE EXCEPTION 'Failed to persist synced transaction';
    END IF;
    IF v_existing.id IS NULL THEN
      v_new_ids := array_append(v_new_ids, v_transaction_id);
    END IF;
  END LOOP;

  -- Removed Plaid transactions become soft-deleted, exactly as in the existing app.
  FOR v_removed IN
    SELECT e.value
      FROM jsonb_array_elements(p_removed) AS e(value)
  LOOP
    IF jsonb_typeof(v_removed) IS DISTINCT FROM 'object'
       OR NULLIF(btrim(v_removed->>'transaction_id'), '') IS NULL
    THEN
      RAISE EXCEPTION 'Invalid removed transaction in sync payload';
    END IF;

    UPDATE public.transactions AS t
       SET is_removed = true
     WHERE t.user_id = p_user_id
       AND t.plaid_item_id = p_item_id
       AND t.plaid_transaction_id = v_removed->>'transaction_id';
    -- Zero matching rows can be valid for an already-removed/unknown provider ID.
  END LOOP;

  -- Reconcile after all changes, independent of added/modified/removed order.
  -- Multiple successors (even removed ones) reject the batch; never pick a
  -- winner or suppress independent posted transactions. Missing sources wait.
  FOR v_posted IN
    SELECT t.* FROM public.transactions t
     WHERE t.user_id = p_user_id AND t.plaid_item_id = p_item_id
       AND t.plaid_pending_transaction_id = ANY(v_keys)
     ORDER BY t.id
  LOOP
    IF (SELECT count(*) FROM public.transactions t
         WHERE t.plaid_item_id = p_item_id
           AND t.plaid_pending_transaction_id = v_posted.plaid_pending_transaction_id) > 1 THEN
      RAISE EXCEPTION 'Ambiguous pending transaction successors';
    END IF;

    -- Global provider-ID uniqueness lets us diagnose a known invalid scope.
    -- Never lock or mutate another Item's source; valid sources are prelocked.
    SELECT * INTO v_pending FROM public.transactions t
     WHERE t.plaid_transaction_id = v_posted.plaid_pending_transaction_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF v_pending.user_id <> p_user_id
       OR v_pending.plaid_item_id IS DISTINCT FROM p_item_id
       OR v_pending.account_id <> v_posted.account_id
       OR NOT v_pending.pending OR v_posted.pending THEN
      RAISE EXCEPTION 'Invalid pending transaction relationship scope or state';
    END IF;

    IF v_posted.plaid_pending_reconciled_at IS NULL THEN
      -- Lock and validate a transferred category; NULL manual is intentional.
      IF v_posted.category_source <> 'manual' AND v_pending.category_source = 'manual'
         AND v_pending.category_id IS NOT NULL THEN
        PERFORM c.id FROM public.categories c
         WHERE c.id = v_pending.category_id AND c.user_id = p_user_id
         FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Invalid pending manual category owner'; END IF;
      END IF;
      UPDATE public.transactions t SET
        category_id = CASE WHEN t.category_source <> 'manual' AND v_pending.category_source = 'manual'
                           THEN v_pending.category_id ELSE t.category_id END,
        category_source = CASE WHEN v_pending.category_source = 'manual' THEN 'manual' ELSE t.category_source END,
        -- Only a newly inserted successor has a provably uninitialized note.
        -- Existing NULL/empty notes may have been intentionally cleared. Never
        -- overwrite those, and never copy again after the one-shot marker.
        note = CASE WHEN t.id = ANY(v_new_ids) AND t.note IS NULL
                    THEN v_pending.note ELSE t.note END,
        plaid_pending_reconciled_at = clock_timestamp()
       WHERE t.id = v_posted.id AND t.user_id = p_user_id
         AND t.plaid_item_id = p_item_id AND t.account_id = v_pending.account_id;
    END IF;

    -- The immutable reference remains a tombstone even if the successor was
    -- removed. Generic soft deletion alone is NOT a supersession signal.
    UPDATE public.transactions t SET is_removed = true
     WHERE t.id = v_pending.id AND t.user_id = p_user_id
       AND t.plaid_item_id = p_item_id AND t.account_id = v_posted.account_id
       AND t.pending AND NOT t.is_removed;
  END LOOP;

  -- Advance the cursor ONLY after every transaction change succeeded.
  UPDATE public.plaid_items AS i
     SET transactions_cursor = p_next_cursor,
         status = 'active',
         last_sync_status = 'succeeded',
         last_sync_error = NULL,
         last_sync_at = clock_timestamp(),
         updated_at = clock_timestamp()
   WHERE i.id = p_item_id
     AND i.user_id = p_user_id
     AND i.sync_lock_token = p_lease_token;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Unable to advance synced cursor';
  END IF;
END;
$$;

-- RPC must be available only to trusted server-side calls.
-- The caller MUST be a server-only service_role client after authorization.
REVOKE ALL ON FUNCTION public.commit_plaid_sync(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.commit_plaid_sync(
  uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb
) TO service_role;
