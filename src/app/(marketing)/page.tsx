import LandingProcess from "../../components/landingPage/LandingProcess";
import LandingSecurity from "../../components/landingPage/LandingSecurity";
import { landingContent } from "../../contents/landingData";
import LandingHero from "@/components/landingPage/LandingHero";

function LandingPage() {
  return (
    <div className="flex flex-col gap-3 landing-bg">
      <LandingHero
        heroData={landingContent.hero}
        buttonData={landingContent.button}
      />
      <LandingProcess howItWorks={landingContent.howItWorks} />
      <LandingSecurity security={landingContent.security} />
    </div>
  );
}

export default LandingPage;
