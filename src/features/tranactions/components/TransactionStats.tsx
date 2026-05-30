type Props = {
  title: "Total Activity" | "Total Income" | "Total Expense";
  amount: string;
};

function TransactionStats({ title, amount }: Props) {
  return (
    <div className="bg-surface-container-low p-6 rounded-2xl flex flex-col justify-between h-36">
      <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-70">
        {title}
      </span>
      <p
        className={`text-3xl font-display font-bold ${title === "Total Income" && "text-primary"} ${title === "Total Expense" && "text-tertiary"}`}
      >
        {amount}
      </p>
    </div>
  );
}

export default TransactionStats;
