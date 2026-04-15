export const landingContent = {
  hero: {
    title: "Automatically track your spending by securely connecting your bank",
    subtitle:
      "No more manual entry. Get instant insights into your expenses by linking your bank account",
  },
  howItWorks: {
    title: "How it works",
    features: [
      {
        logo: "/icons/shield.svg",
        title: "Connect your bank",
        description: "Securely link your bank in seconds",
      },
      {
        logo: "/icons/chart.svg",
        title: "Get instant insights",
        description: "See all your expenses automatically categorized",
      },
      {
        logo: "/icons/lightbulp.svg",
        title: "Gain financial clarity",
        description:
          "Understand your spending patterns instantly with AI analysis",
      },
    ],
  },

  security: {
    question: "Is it safe to connect my bank?",
    answer:
      "Yes, we use Plaid, a trusted industry leader, to securely link your bank without storing your login details. Plaid is used by major fintech companies like Venmo, Robinhood, and Acorns to connect bank accounts",
    keys: [
      { icon: "✅", explanation: "We never see or store your bank login" },
      { icon: "✅", explanation: "Your data is encrypted and protected" },
      {
        icon: "✅",
        explanation: "Read-Only access - We can never move money",
      },
    ],
  },

  button: { buttonText: "Get Started" },
};
