import { describe, expect, it, vi } from "vitest";
import {
  formatSubscriptionAmount,
  formatSubscriptionDate,
} from "../components/formatSubscription";

describe("formatSubscriptionAmount", () => {
  it.each([
    { currency: "USD", minor: 999, expected: "US$9.99" },
    { currency: "CAD", minor: 1599, expected: "CA$15.99" },
    { currency: "JPY", minor: 1480, expected: "¥1,480" },
    { currency: "USD", minor: 1, expected: "US$0.01" },
    { currency: "CAD", minor: 1, expected: "CA$0.01" },
    { currency: "JPY", minor: 1, expected: "¥1" },
  ])(
    "formats $minor minor units in $currency as $expected",
    ({ currency, minor, expected }) => {
      expect(formatSubscriptionAmount(minor, currency)).toBe(expected);
    },
  );
});

const calendarDates = [
  { date: "2026-01-01", expected: "Jan 1, 2026" },
  { date: "2024-02-29", expected: "Feb 29, 2024" },
  { date: "2026-03-08", expected: "Mar 8, 2026" },
  { date: "2026-11-01", expected: "Nov 1, 2026" },
  { date: "2026-12-31", expected: "Dec 31, 2026" },
];

describe("formatSubscriptionDate", () => {
  it.each(calendarDates)(
    "formats the calendar date $date as $expected",
    ({ date, expected }) => {
      expect(formatSubscriptionDate(date)).toBe(expected);
    },
  );

  it.each(["UTC", "America/Vancouver", "Pacific/Honolulu", "Asia/Tokyo"])(
    "preserves UTC calendar dates when the host timezone is %s",
    async (timeZone) => {
      vi.stubEnv("TZ", timeZone);
      try {
        expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
          timeZone,
        );
        // Recreate the module-level formatter after changing the host timezone.
        vi.resetModules();
        const { formatSubscriptionDate: formatInTimeZone } = await import(
          "../components/formatSubscription"
        );

        for (const { date, expected } of calendarDates) {
          expect(formatInTimeZone(date)).toBe(expected);
        }
      } finally {
        vi.unstubAllEnvs();
        vi.resetModules();
      }
    },
  );
});
