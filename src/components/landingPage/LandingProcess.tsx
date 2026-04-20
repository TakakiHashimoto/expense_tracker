type props = {
  howItWorks: {
    title: string;
    subtitle: string;
    features: { logo: string; title: string; description: string }[];
  };
};

function LandingProcess({ howItWorks }: props) {
  const accentStyles = [
    { panel: "bg-primary/10", icon: "text-primary" },
    { panel: "bg-secondary/10", icon: "text-secondary" },
    { panel: "bg-tertiary/10", icon: "text-tertiary" },
  ];

  return (
    <section className="mx-auto mb-48 max-w-7xl px-8">
      <div className="mb-20 text-center">
        <h2 className="mb-4 text-4xl font-bold mt-8">{howItWorks.title}</h2>
        <p className="mx-auto max-w-2xl text-on-surface-variant">
          {howItWorks.subtitle}
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        {howItWorks.features.map((feature, index) => {
          const accent = accentStyles[index] ?? accentStyles[0];

          return (
            <div
              key={feature.title}
              className="group rounded-3xl bg-surface-container-low p-10 transition-all hover:-translate-y-2"
            >
              <div
                className={`mb-8 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${accent.panel}`}
              >
                <span
                  className={`material-symbols-outlined text-3xl ${accent.icon}`}
                >
                  {feature.logo}
                </span>
              </div>
              <h3 className="mb-4 text-2xl font-bold">{feature.title}</h3>
              <p className="leading-relaxed text-on-surface-variant">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default LandingProcess;
