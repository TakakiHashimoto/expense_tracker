import Image from "next/image";
import { PhoneMock } from "../PhoneImage";
import GetStartedButton from "./GetStartedButton";

type props = {
  heroData: { title: string; subtitle: string };
  buttonData: { buttonText: string };
};

function LandingHero({ heroData, buttonData }: props) {
  return (
    <section className="flex gap-2 justify-between items-start m-10 h-auto">
      <div className="w-[45%] flex flex-col gap-7 mt-5 ml-5">
        <h1 className="text-5xl">{heroData.title}</h1>
        <p className="text-white/50">{heroData.subtitle}</p>
        <GetStartedButton button={buttonData} />
      </div>
      <div className="w-[45%]">
        <Image
          className="w-full"
          src="/app-content.png"
          alt="app content"
          width={200}
          height={400}
        />
      </div>
    </section>
  );
}

export default LandingHero;
