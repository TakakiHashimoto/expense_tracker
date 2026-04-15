import { seedData } from "@/features/dev/seed/action";

export default function SeedData() {
  return (
    <form action={seedData}>
      <button>Seed Data</button>
    </form>
  );
}
