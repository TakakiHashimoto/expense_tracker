type props = {
  security: {
    question: string;
    answer: string;
    keys: { icon: string; explanation: string }[];
  };
};

function LandingSecurity({ security }: props) {
  return (
    <section className="mb-32 bg-surface-container-lowest py-32">
      <div className="mx-auto grid max-w-7xl items-center gap-20 px-8 lg:grid-cols-2">
        <div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <span className="material-symbols-outlined text-sm">
              verified_user
            </span>
            Bank-level security
          </div>
          <h2 className="mb-8 text-4xl font-bold leading-tight md:text-5xl">
            {security.question}
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-on-surface-variant">
            {security.answer}
          </p>
          <div className="space-y-6">
            {security.keys.map((key) => (
              <div key={key.explanation} className="flex gap-4">
                <span className="material-symbols-outlined text-primary">
                  {key.icon}
                </span>
                <p className="font-medium">{key.explanation}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="overflow-hidden rounded-3xl border border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(78,222,163,0.22),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(173,198,255,0.18),transparent_28%),linear-gradient(180deg,rgba(23,27,38,0.95),rgba(10,14,24,0.98))] shadow-2xl">
            <div className="relative aspect-4/3 w-full">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[48px_48px] opacity-30" />
              <div className="absolute left-10 top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute bottom-8 right-8 h-32 w-32 rounded-full bg-secondary/10 blur-3xl" />
              <div className="absolute left-8 top-8 right-8 bottom-8 rounded-[28px] border border-white/8 bg-white/4 backdrop-blur-sm" />
              <div className="absolute left-[18%] top-[24%] h-3 w-3 rounded-full bg-primary shadow-[0_0_24px_rgba(78,222,163,0.8)]" />
              <div className="absolute left-[38%] top-[38%] h-2.5 w-2.5 rounded-full bg-secondary shadow-[0_0_18px_rgba(173,198,255,0.8)]" />
              <div className="absolute left-[58%] top-[28%] h-3 w-3 rounded-full bg-primary shadow-[0_0_24px_rgba(78,222,163,0.8)]" />
              <div className="absolute left-[72%] top-[52%] h-2.5 w-2.5 rounded-full bg-tertiary shadow-[0_0_18px_rgba(255,179,175,0.8)]" />
              <div className="absolute left-[30%] top-[64%] h-3 w-3 rounded-full bg-primary shadow-[0_0_24px_rgba(78,222,163,0.8)]" />
              <div className="absolute left-[48%] top-[72%] h-2.5 w-2.5 rounded-full bg-secondary shadow-[0_0_18px_rgba(173,198,255,0.8)]" />
              <div className="absolute left-[19%] top-[25%] h-px w-[22%] rotate-18 bg-linear-to-r from-primary/80 to-transparent" />
              <div className="absolute left-[39%] top-[39%] h-px w-[20%] -rotate-22 bg-linear-to-r from-secondary/80 to-transparent" />
              <div className="absolute left-[31%] top-[64%] h-px w-[18%] rotate-10 bg-linear-to-r from-primary/80 to-transparent" />
              <div className="absolute left-[59%] top-[29%] h-px w-[16%] rotate-36 bg-linear-to-r from-primary/80 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-surface-container-lowest to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LandingSecurity;
