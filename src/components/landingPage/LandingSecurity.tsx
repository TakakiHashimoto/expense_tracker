type props = {
  security: {
    question: string;
    answer: string;
    keys: { icon: string; explanation: string }[];
  };
};

function LandingSecurity({ security }: props) {
  return (
    <section className="mb-32 bg-surface-container-lowest py-12">
      {/* <div className="mx-auto grid max-w-7xl items-center gap-20 px-8 lg:grid-cols-2"> */}
      <div className="flex flex-col sm:flex-row px-8">
        <div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <span className="material-symbols-outlined text-sm">
              verified_user
            </span>
            Plaid-powered connection
          </div>
          <h2 className="mb-8 text-4xl font-bold leading-tight md:text-5xl">
            {security.question}
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-on-surface-variant">
            {security.answer}
          </p>
        </div>
        <div className="space-y-6 mt-12">
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
      {/* </div> */}
    </section>
  );
}

export default LandingSecurity;
