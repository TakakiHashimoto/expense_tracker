import { getBudgets } from "@/features/budgets/actions";
import BudgetDisplayPageClient from "@/features/budgets/pages/BudgetDisplayPageClient";

async function page() {
  const res = await getBudgets();
  if (!res.ok) {
    return (
      <div>
        <p>{res.error}</p>
      </div>
    );
  }

  return <BudgetDisplayPageClient budgets={res.data} />;
}

export default page;
