export type AccountQueryRowType = {
  id: string;
  name: string;
  type: string;
  current_balance: number | null;
  subtype: string | null;
  mask: string | null;
  currency: string | null;
  plaid_item: {
    id: string;
    institution_name: string;
    last_sync_status: SyncStatus;
    last_sync_error: string;
    last_sync_at: string;
    status: ConnectionStatus;
  };
};

export type ConnectionStatus = "active" | "error" | "revoked";

export type SyncStatus = "never_synced" | "syncing" | "succeeded" | "failed";

export type ConnectionHealth =
  | "healthy"
  | "needs_update"
  | "sync_failed"
  | "never_synced"
  | "disconnected";

export type AccountPageAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  currency: string | null;
};

export type AccountPageInstitution = {
  plaidItemId: string;
  institutionName: string;
  connectionStatus: ConnectionStatus;
  syncStatus: SyncStatus;
  health: ConnectionHealth;
  lastSyncError: string | null;
  lastSyncedAt: string | null;
  accounts: AccountPageAccount[];
};

export type AccountPageData =
  | { ok: true; institutions: AccountPageInstitution[] }
  | { ok: false; error: string };

export type AccountDetailDataRow = {
  id: string;
  type: string;
  name: string;
  currency: string;
  is_active: boolean;
  mask: number;
  subtype: string | null;
  current_balance: number | null;
  instituion: {
    id: string;
    institution_name: string;
    last_sync_status: SyncStatus;
    last_sync_error: string;
    last_sync_at: string;
    status: ConnectionStatus;
  };
};

export type AccountDetailData =
  | { ok: true; account: AccountDetailDataRow }
  | { ok: false; error: string };
