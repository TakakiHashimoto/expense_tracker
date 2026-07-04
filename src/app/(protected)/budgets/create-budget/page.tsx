import { getCategories } from "@/features/budgets/actions";
import BudgetCreatePageClient from "@/features/budgets/pages/BudgetCreatePageClient";

async function page() {
  const categData = await getCategories();
  if (!categData.ok) {
    return (
      <div>
        <p>Failed to fetch categories</p>
      </div>
    );
  }

  return <BudgetCreatePageClient categories={categData.categories} />;
}

export default page;
