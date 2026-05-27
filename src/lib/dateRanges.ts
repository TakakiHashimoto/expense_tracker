// One united date format.

export type DashboardDateRange = {
  timeZone: string;
  nowIso: string;
  todayStartIso: string;
  tomorrowStartIso: string;
  monthStartIso: string;
  nextMonthStartIso: string;
};

import { DateTime } from "luxon";

const APP_TIME_ZONE = "America/Vancouver";

export function getDashboardDateRange(timeZone = APP_TIME_ZONE) {
  const now = DateTime.now().setZone(timeZone);

  const todayStart = now.startOf("day");
  const tomorrowStart = todayStart.plus({ days: 1 });

  const monthStart = now.startOf("month");
  const nextMonthStart = monthStart.plus({ months: 1 });

  const nowIso = now.toUTC().toISO();
  if (!nowIso) throw new Error("Failed to create now ISO");

  const todayStartIso = todayStart.toUTC().toISO();

  if (!todayStartIso) {
    throw new Error("Failed to create todayStartISO");
  }

  const tomorrowStartIso = tomorrowStart.toUTC().toISO();
  if (!tomorrowStartIso) {
    throw new Error("Failed to create tomorrowStartISO");
  }

  const monthStartIso = monthStart.toUTC().toISO();
  if (!monthStartIso) {
    throw new Error("Failed to create monthStartISO");
  }

  const nextMonthStartIso = nextMonthStart.toUTC().toISO();
  if (!nextMonthStartIso) {
    throw new Error("Failed to create nextMonthStartISO");
  }
  return {
    timeZone,
    nowIso,
    todayStartIso,
    tomorrowStartIso,
    monthStartIso,
    nextMonthStartIso,
  };
}
