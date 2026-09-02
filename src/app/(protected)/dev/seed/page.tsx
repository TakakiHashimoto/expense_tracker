import { seedData } from "@/features/dev/seed/action";

export default function SeedData() {
  return (
    <div className="flex justify-center items-center">
      <form action={seedData} className="my-6">
        <button className="btn-primary">Seed Data</button>
      </form>
    </div>
  );
}
