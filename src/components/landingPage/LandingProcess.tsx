import Description from "./Description";

type props = {
  howItWorks: {
    title: string;
    features: {
      logo: string;
      title: string;
      description: string;
    }[];
  };
};

function LandingProcess({ howItWorks }: props) {
  return (
    <section>
      <h2>{howItWorks.title}</h2>
      <div>
        {howItWorks.features.map((feature) => (
          <Description
            key={feature.title}
            icon={feature.logo}
            alt="image"
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </section>
  );
}

export default LandingProcess;
