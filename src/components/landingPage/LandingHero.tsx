import Image from "next/image";
import { PhoneMock } from "../PhoneImage";
import GetStartedButton from "./GetStartedButton";
import DashboardMock from "./DashboardMock";

type props = {
  heroData: { title: string; subtitle: string };
  buttonData: { buttonText: string };
};

function LandingHero({ heroData, buttonData }: props) {
  return (
    <section className="flex gap-2 justify-between items-start m-10 h-auto">
      <div className="max-w-[45%] flex flex-col gap-10 mt-5 ml-5">
        <h1 className="text-5xl flex flex-col">
          Automatically track your spending by
          <span className="gradient-text">securely connecting your bank</span>
        </h1>
        <p className="text-white/50 ml-2">{heroData.subtitle}</p>
        <GetStartedButton button={buttonData} />
      </div>
      <div className="max-w-[45%]">
        <DashboardMock />
      </div>
    </section>
  );
}

export default LandingHero;
