export const landingContent = {
  hero: {
    title:
      "Understand your accounts, transactions, and monthly spending in one place",
    subtitle:
      "Connect a bank through Plaid Sandbox, sync your transactions, review monthly cash flow, and track category budgets.",
  },

  howItWorks: {
    title: "How BankOS works",
    subtitle:
      "Connect an account, review your financial activity, and turn transactions into a clearer monthly picture.",

    features: [
      {
        logo: "account_balance",
        title: "Connect with Plaid",
        description:
          "Use Plaid Link in the Sandbox environment to connect financial accounts and securely sync account and transaction data.",
      },
      {
        logo: "insights",
        title: "Understand your transactions",
        description:
          "Review transactions by month, search and filter activity, and see monthly income, spending, and net cash flow.",
      },
      {
        logo: "savings",
        title: "Track monthly budgets",
        description:
          "Create category budgets and compare your planned spending with actual transactions throughout the month.",
      },
    ],
  },

  security: {
    question: "How does BankOS connect to financial accounts?",
    answer:
      "BankOS uses Plaid Link for account connectivity. This portfolio deployment runs entirely in Plaid Sandbox, so it demonstrates the bank-linking and synchronization flow without connecting to real financial accounts.",

    keys: [
      {
        icon: "check_circle",
        explanation:
          "Bank login credentials are not exposed to the BankOS application",
      },
      {
        icon: "check_circle",
        explanation:
          "Sensitive Plaid credentials are kept on the server rather than exposed to the browser",
      },
      {
        icon: "check_circle",
        explanation:
          "BankOS reads account and transaction data and does not provide money-transfer functionality",
      },
    ],
  },
};
