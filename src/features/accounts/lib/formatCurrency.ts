export function formatCurrency(
  currency: string | null,
  balance: number | null,
) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(balance || 0);
}
