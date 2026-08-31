// One united date format.

export type DashboardDateRange = {
  timeZone: string;

  todayDate: string;
  tomorrowDate: string;

  monthStartDate: string;
  nextMonthStartDate: string;
};

import { DateTime } from "luxon";

const APP_TIME_ZONE = "America/Vancouver";

export function getDashboardDateRange(
  timeZone = APP_TIME_ZONE,
): DashboardDateRange {
  const now = DateTime.now().setZone(timeZone);

  const monthStart = now.startOf("month");
  const nextMonthStart = monthStart.plus({ months: 1 });

  const todayDate = now.toISODate();
  const tomorrowDate = now.plus({ days: 1 }).toISODate();

  const monthStartDate = monthStart.toISODate();
  const nextMonthStartDate = nextMonthStart.toISODate();

  if (!todayDate || !tomorrowDate || !monthStartDate || !nextMonthStartDate) {
    throw new Error("Failed to create dashboard date range");
  }

  return {
    timeZone,
    todayDate,
    tomorrowDate,
    monthStartDate,
    nextMonthStartDate,
  };
}
