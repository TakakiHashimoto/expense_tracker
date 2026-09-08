import { seedData } from "@/features/dev/seed/action";
import { notFound } from "next/navigation";

export default function SeedData() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="flex justify-center items-center">
      <form action={seedData} className="my-6">
        <button className="btn-primary">Seed Data</button>
      </form>
    </div>
  );
}
