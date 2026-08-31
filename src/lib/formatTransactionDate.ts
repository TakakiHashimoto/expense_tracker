const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export default function formatTransactionDate(postedDate: string) {
  const [year, month, day] = postedDate.split("-");

  const monthIndex = Number(month) - 1;
  const monthName = MONTH_NAMES[monthIndex];

  if (!year || !monthName || !day) {
    throw new Error(`Invalid transaction date: ${postedDate}`);
  }

  return `${monthName} ${Number(day)}, ${year}`;
}
