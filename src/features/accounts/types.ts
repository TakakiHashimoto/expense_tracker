export type AccountQueryRowType = {
  id: string;
  name: string;
  type: string;
  current_balance: number | null;
  subtype: string | null;
  mask: string | null;
  plaid_item: {
    id: string;
    institution_name: string | null;
    last_sync_at: string | null;
    status: string;
  } | null;
};

export type HealthType =
  | "Healthy"
  | "need_update"
  | "sync_failed"
  | "never_synced";

export type AccountPageAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
};

export type AccountPageInstitution = {
  plaidItemId: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  accounts: AccountPageAccount[];
};

export type AccountPageData =
  | { ok: true; institutions: AccountPageInstitution[] }
  | { ok: false; error: string };
