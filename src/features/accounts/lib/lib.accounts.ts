import { ConnectionHealth, ConnectionStatus, SyncStatus } from "../types";

export function deriveConnectionHealth({
  connectionStatus,
  syncStatus,
  lastSyncedAt,
  lastSyncError,
}: {
  connectionStatus: ConnectionStatus;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}): ConnectionHealth {
  if (connectionStatus === "revoked") {
    return "disconnected";
  }

  if (connectionStatus === "error" && lastSyncError === "ITEM_LOGIN_REQUIRED") {
    return "needs_update";
  }

  if (syncStatus === "failed") {
    return "sync_failed";
  }

  if (syncStatus === "never_synced" || !lastSyncedAt) {
    return "never_synced";
  }

  return "healthy";
}
