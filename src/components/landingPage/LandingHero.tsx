import GetStartedButton from "./GetStartedButton";
import DashboardMock from "../common/DashboardMock";

type props = { heroData: { title: string; subtitle: string } };

function LandingHero({ heroData }: props) {
  return (
    <section className="flex gap-2 justify-between items-start m-10 h-auto">
      <div className="w-full lg:max-w-[45%] flex flex-col gap-10 mt-5 lg:ml-5">
        <h1 className="text-3xl lg:text-5xl flex flex-col">{heroData.title}</h1>
        <p className="text-white/50 ml-2">{heroData.subtitle}</p>
        <GetStartedButton />
      </div>
      <div className="max-w-[45%] hidden lg:block">
        <DashboardMock />
      </div>
    </section>
  );
}

export default LandingHero;
