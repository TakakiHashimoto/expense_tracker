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
    last_sync_status: SyncStatus | null;
    last_sync_error: string | null;
    last_sync_at: string | null;
    status: ConnectionStatus | null;
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
  type: string | null;
  name: string;
  currency: string | null;
  is_active: boolean;
  mask: string | null;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  institution: {
    id: string;
    institution_name: string | null;
    last_sync_status: SyncStatus | null;
    last_sync_error: string | null;
    last_sync_at: string | null;
    status: ConnectionStatus;
  };
};

export type AccountDetailPageData = {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currency: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  institution: {
    id: string;
    institutionName: string;
    status: ConnectionStatus;
    lastSyncStatus: SyncStatus;
    lastSyncError: string | null;
    lastSyncAt: string | null;
  };
  health: ConnectionHealth;
};

export type AccountDetailData =
  | { ok: true; account: AccountDetailPageData }
  | { ok: false; error: string };

export type HealthPresentation = {
  label: string;
  description: string | null;
  badgeClassName: string;
  action: "repair" | "sync" | null;
};
