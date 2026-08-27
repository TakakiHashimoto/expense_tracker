export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-3">
        <div className="h-8 w-48 rounded bg-surface-container-low" />
        <div className="h-4 w-72 rounded bg-surface-container-low" />
      </div>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl bg-surface-container-low p-6 space-y-4"
          >
            <div className="h-3 w-24 rounded bg-surface-container" />
            <div className="h-8 w-32 rounded bg-surface-container" />
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-surface-container-low p-6 space-y-4">
        <div className="h-5 w-40 rounded bg-surface-container" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b border-outline/20 pb-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-surface-container" />
              <div className="h-3 w-24 rounded bg-surface-container" />
            </div>
            <div className="h-4 w-20 rounded bg-surface-container" />
          </div>
        ))}
      </section>
    </div>
  );
}
