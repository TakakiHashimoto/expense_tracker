function DashboardMock() {
  return (
    <div className="relative mr-6">
      <div className="absolute -inset-4 bg-primary/10 blur-[100px] rounded-full" />
      <div className="relative glass-panel rounded-3xl p-8 shadow-2xl border border-white/5 overflow-hidden">
        <div className="flex justify-between items-end mb-12">
          <div>
            <span className="text-sm uppercase tracking-widest text-on-surface-variant mb-2 block">
              Total Monthly Spend
            </span>
            <div className="text-5xl font-black text-white">$4,282.50</div>
          </div>
          <div className="h-16 w-32">
            {/* Visual Sparkline representation */}
            <svg className="h-full w-full" viewBox="0 0 100 40">
              <path
                d="M0 35 Q 20 10, 40 25 T 80 5 T 100 20"
                fill="none"
                stroke="#4edea3"
                strokeLinecap="round"
                strokeWidth="3"
              />
              <path
                d="M0 35 Q 20 10, 40 25 T 80 5 T 100 20 L 100 40 L 0 40 Z"
                fill="url(#sparklineGradient)"
              />
              <defs>
                <linearGradient
                  id="sparklineGradient"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#4edea3" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4edea3" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container-high rounded-2xl p-4">
            <span className="material-symbols-outlined text-primary mb-2">
              restaurant
            </span>
            <div className="text-xs text-on-surface-variant font-medium">
              Food
            </div>
            <div className="text-lg font-bold">$840.20</div>
          </div>
          <div className="bg-surface-container-high rounded-2xl p-4">
            <span className="material-symbols-outlined text-secondary mb-2">
              directions_car
            </span>
            <div className="text-xs text-on-surface-variant font-medium">
              Transport
            </div>
            <div className="text-lg font-bold">$320.15</div>
          </div>
          <div className="bg-surface-container-high rounded-2xl p-4">
            <span className="material-symbols-outlined text-tertiary mb-2">
              subscriptions
            </span>
            <div className="text-xs text-on-surface-variant font-medium">
              Subs
            </div>
            <div className="text-lg font-bold">$142.00</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/5">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 flex h-10 w-10 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-sm">
                  shopping_bag
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold">Apple Store</div>
                <div className="text-xs text-on-surface-variant">
                  Electronics • Today
                </div>
              </div>
            </div>
            <div className="text-sm font-bold text-tertiary">-$999.00</div>
          </div>
          <div className="flex items-center justify-between rounded-xl p-3 transition-colors hover:bg-white/5">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 flex h-10 w-10 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-sm">
                  local_cafe
                </span>
              </div>
              <div>
                <div className="text-sm font-semibold">Blue Bottle Coffee</div>
                <div className="text-xs text-on-surface-variant">
                  Dining • Yesterday
                </div>
              </div>
            </div>
            <div className="text-sm font-bold text-tertiary">-$6.50</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardMock;
