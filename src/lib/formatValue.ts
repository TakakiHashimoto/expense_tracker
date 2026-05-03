export function formatValue(value: number, type: "money" | "count"): string {
  if (type === "money") {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(value);
  }

  return String(value);
}

export function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Math.abs(amount));
}
