import { ConnectionHealth, ConnectionStatus, SyncStatus } from "../types";

export function deriveConnectionHealth({
  connectionStatus,
  syncStatus,
  lastSyncedAt,
}: {
  connectionStatus: ConnectionStatus;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
}): ConnectionHealth {
  if (connectionStatus === "disconnected") {
    return "disconnected";
  }

  if (connectionStatus === "needs_update") {
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
