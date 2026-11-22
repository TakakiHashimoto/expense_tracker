/** Use the currency's precision to convert minor units, including zero-decimal JPY. */
export function formatSubscriptionAmount(amountMinor: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;

  return formatter
    .formatToParts(amountMinor / 10 ** fractionDigits)
    .map((part) =>
      part.type === "currency" && currency === "USD" ? "US$" : part.value,
    )
    .join("");
}

const paymentDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatSubscriptionDate(date: string) {
  return paymentDateFormatter.format(new Date(`${date}T00:00:00Z`));
}
