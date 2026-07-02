type DashboardStatsProps = {
  title: string;
  value: string;
  type:
    | "monthly-spending"
    | "today-total"
    | "monthly-income"
    | "recent-activities";
};

function DashboardStats({ title, value, type }: DashboardStatsProps) {
  const textColor = {
    "monthly-spending": "text-tertiary",
    "monthly-income": "text-primary",
    "today-total": "text-yellow-400/90",
    "recent-activities": "text-secondary",
  };
  return (
    <div className="flex flex-col bg-surface-container-low p-6 rounded-2xl relative overflow-hidden group shadow-lg">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-tertiary-container/10 rounded-full blur-3xl group-hover:bg-tertiary-container/20 transition-all"></div>
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2">
        {title}
      </p>
      <p className={`text-3xl font-bold ${textColor[type]} tracking-tighter`}>
        {value}
      </p>
    </div>
  );
}

export default DashboardStats;
