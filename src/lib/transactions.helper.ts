type PlaidTransactionType = {
  amount: number;
  rawCategory: string;
  rawDetail: string;
  merchantName: string;
};

type TransactionKind = "income" | "expense";

type NormalizedCategory = {
  kind: TransactionKind;
  name: string;
  rawCategory: string;
};
type MerchantRule = { keywords: string[]; category: string };

// this is for merchat based category
const MERCHANT_RULES: MerchantRule[] = [
  {
    keywords: [
      "walmart",
      "costco",
      "safeway",
      "save-on-foods",
      "superstore",
      "nofrills",
      "loblaws",
    ],
    category: "Groceries",
  },
  {
    keywords: [
      "starbucks",
      "mcdonald",
      "subway",
      "doordash",
      "ubereats",
      "tim hortons",
      "timhortons",
    ],
    category: "Food",
  },
  {
    keywords: ["uber", "lyft", "shell", "chevron", "esso", "petro-canada"],
    category: "Transport",
  },
  {
    keywords: ["amazon", "amzn", "ebay", "best buy", "bestbuy", "uniqlo"],
    category: "Shopping",
  },
  {
    keywords: ["netflix", "spotify", "youtube", "cineplex"],
    category: "Entertainment",
  },
  { keywords: ["bc hydro", "rogers", "telus", "bell"], category: "Bills" },
];

function normalizeMerchantName(rawMerchantName: string): string {
  return rawMerchantName.trim().toLowerCase();
}

function normalizeRawCategName(rawCategory: string) {
  return rawCategory.trim().toLowerCase();
}

function mapMerchantToCategory(merchantName?: string | null): string | null {
  if (!merchantName) return null;

  const merchant = normalizeMerchantName(merchantName);

  for (const rule of MERCHANT_RULES) {
    const matched = rule.keywords.some((keyword) => merchant.includes(keyword));
    if (matched) return rule.category;
  }

  return null;
}

function normalizeCategory(
  plaidTransaction: PlaidTransactionType,
): NormalizedCategory {
  const kind = plaidTransaction.amount > 0 ? "income" : "expense";
  const rawDetailed = normalizeRawCategName(plaidTransaction.rawDetail);
  const rawPrimary = normalizeRawCategName(plaidTransaction.rawCategory);
  const merchantCategory = mapMerchantToCategory(plaidTransaction.merchantName);

  // if kind === income,
  if (kind === "income") {
    // if payroll / income, Salary
    if (rawDetailed.includes("payroll") || rawPrimary.includes("income")) {
      return { kind: "income", name: "Salary", rawCategory: rawPrimary };
    }
    // if refund, Refund
    if (rawDetailed.includes("refund")) {
      return { kind: "income", name: "Refund", rawCategory: rawPrimary };
    }
    // else, other income
    return { kind: "income", name: "Other Income", rawCategory: rawPrimary };
  }

  // if kind === expense,
  if (rawPrimary.includes("food")) {
    return { kind: "expense", name: "Food", rawCategory: rawPrimary };
  }

  if (rawPrimary.includes("transport")) {
    return { kind: "expense", name: "Transport", rawCategory: rawPrimary };
  }

  if (rawPrimary.includes("entertainment")) {
    return { kind: "expense", name: "Entertainment", rawCategory: rawPrimary };
  }

  if (rawPrimary.includes("general_merchandise")) {
    return { kind: "expense", name: "Shopping", rawCategory: rawPrimary };
  }

  if (rawPrimary.includes("utilities") || rawPrimary.includes("payment")) {
    return { kind: "expense", name: "Bills", rawCategory: rawPrimary };
  }

  if (merchantCategory) {
    return { kind: "expense", name: merchantCategory, rawCategory: rawPrimary };
  }

  return { kind: "expense", name: "Other Expense", rawCategory: rawPrimary };
}

export { mapMerchantToCategory, normalizeCategory };
