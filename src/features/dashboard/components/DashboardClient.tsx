import { type DashboardType } from "../type";

type Props = { initialValue: DashboardType };

export default function DashboardClient({ initialValue }: Props) {
  console.log(initialValue);
  return (
    <div>
      {initialValue.monthlyExpenses.length === 0 ? (
        <p>0</p>
      ) : (
        initialValue.monthlyExpenses.map((item) => (
          <p key={item.id}>{item.amount}</p>
        ))
      )}
    </div>
  );
}

// ###################### initialValue ##########################
// {
//   monthlyExpenses: [
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-14T00:00:00+00:00',
//       amount: -5.4,
//       merchant: 'Uber',
//       note: null
//     },
//     {
//       account_id: '70e0a4f2-27f3-4e16-a1a0-80ab95820b6d',
//       category_id: null,
//       posted_at: '2026-04-14T00:00:00+00:00',
//       amount: -25,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: 'f0ac6505-f242-4bb3-9290-a3c5b436f242',
//       category_id: null,
//       posted_at: '2026-04-13T00:00:00+00:00',
//       amount: -1000,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: '12c10c59-aacb-4238-bd06-9578b1e69f8c',
//       category_id: null,
//       posted_at: '2026-04-13T00:00:00+00:00',
//       amount: -5850,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: '9250572b-ad71-413e-9e5d-d883ea1140ce',
//       category_id: null,
//       posted_at: '2026-04-12T00:00:00+00:00',
//       amount: -78.5,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-11T00:00:00+00:00',
//       amount: -12,
//       merchant: "McDonald's",
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-11T00:00:00+00:00',
//       amount: -4.33,
//       merchant: 'Starbucks',
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-10T00:00:00+00:00',
//       amount: -89.4,
//       merchant: 'FUN',
//       note: null
//     }
//   ],
//   monthlyIncome: [
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-12T00:00:00+00:00',
//       amount: 500,
//       merchant: 'United Airlines',
//       note: null
//     },
//     {
//       account_id: '70e0a4f2-27f3-4e16-a1a0-80ab95820b6d',
//       category_id: null,
//       posted_at: '2026-04-09T00:00:00+00:00',
//       amount: 4.22,
//       merchant: null,
//       note: null
//     }
//   ],
//   monthlyTotoal: -7064.63,
//   recentTransactions: [
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-14T00:00:00+00:00',
//       amount: -5.4,
//       merchant: 'Uber',
//       note: null
//     },
//     {
//       account_id: '70e0a4f2-27f3-4e16-a1a0-80ab95820b6d',
//       category_id: null,
//       posted_at: '2026-04-14T00:00:00+00:00',
//       amount: -25,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: 'f0ac6505-f242-4bb3-9290-a3c5b436f242',
//       category_id: null,
//       posted_at: '2026-04-13T00:00:00+00:00',
//       amount: -1000,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: '12c10c59-aacb-4238-bd06-9578b1e69f8c',
//       category_id: null,
//       posted_at: '2026-04-13T00:00:00+00:00',
//       amount: -5850,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-12T00:00:00+00:00',
//       amount: 500,
//       merchant: 'United Airlines',
//       note: null
//     },
//     {
//       account_id: '9250572b-ad71-413e-9e5d-d883ea1140ce',
//       category_id: null,
//       posted_at: '2026-04-12T00:00:00+00:00',
//       amount: -78.5,
//       merchant: null,
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-11T00:00:00+00:00',
//       amount: -12,
//       merchant: "McDonald's",
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-11T00:00:00+00:00',
//       amount: -4.33,
//       merchant: 'Starbucks',
//       note: null
//     },
//     {
//       account_id: '87f191d0-4729-4f93-96a3-4e76d2ddcccf',
//       category_id: null,
//       posted_at: '2026-04-10T00:00:00+00:00',
//       amount: -89.4,
//       merchant: 'FUN',
//       note: null
//     },
//     {
//       account_id: '70e0a4f2-27f3-4e16-a1a0-80ab95820b6d',
//       category_id: null,
//       posted_at: '2026-04-09T00:00:00+00:00',
//       amount: 4.22,
//       merchant: null,
//       note: null
//     }
//   ],
//   todayTotal: 0
// }
