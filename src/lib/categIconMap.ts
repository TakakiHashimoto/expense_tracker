import {
  Banknote,
  Car,
  CircleDollarSign,
  Film,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

const categIconMap: Record<string, LucideIcon> = {
  Bills: ReceiptText,
  Entertainment: Film,
  Food: Utensils,
  Groceries: ShoppingCart,
  Refund: RotateCcw,
  Salary: Banknote,
  Shopping: ShoppingBag,
  Transport: Car,
  "Other Income": CircleDollarSign,
  "Other Expense": Wallet,
  Uncategorized: ReceiptText,
};

function getCategIcon(categoryName?: string | null): LucideIcon {
  return categIconMap[categoryName ?? "Uncategorized"] ?? ReceiptText;
}

export { categIconMap, getCategIcon };
