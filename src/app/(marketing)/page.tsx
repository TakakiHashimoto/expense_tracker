import GetStartedButton from "@/components/landingPage/GetStartedButton";
import LandingProcess from "../../components/landingPage/LandingProcess";
import LandingSecurity from "../../components/landingPage/LandingSecurity";
import { landingContent } from "../../contents/landingData";
import LandingHero from "@/components/landingPage/LandingHero";

function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col gap-10">
      <LandingHero heroData={landingContent.hero} />
      <LandingProcess howItWorks={landingContent.howItWorks} />
      <LandingSecurity security={landingContent.security} />
      <div className="mb-10 text-center w-full">
        <GetStartedButton />
      </div>
    </div>
  );
}

export default LandingPage;
