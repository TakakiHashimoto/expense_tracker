import { type DashboardType } from "../type";

type Props = {
  initialValue: DashboardType;
};

export default function DashboardClient({ initialValue }: Props) {
  return (
    <div>
      {initialValue.monthlyExpenses.length === 0 ? (
        <p>0</p>
      ) : (
        initialValue.monthlyExpenses.map((item) => (
          <p key={item.posted_at}>{item.amount}</p>
        ))
      )}
    </div>
  );
}
