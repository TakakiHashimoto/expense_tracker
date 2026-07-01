import { DateTime } from "luxon";
export function formatLastSync(value: string | null) {
  if (!value) return "Never synced";

  const date = DateTime.fromISO(value);

  if (!date.isValid) return "Sync time unavailable";

  return date.toRelative() ?? date.toLocaleString(DateTime.DATETIME_MED);
}
