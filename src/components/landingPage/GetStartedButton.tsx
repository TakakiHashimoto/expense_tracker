import { getUserOnboardingState } from "@/features/auth/actions";
import Link from "next/link";

type props = { button: { buttonText: string } };

async function GetStartedButton({ button }: props) {
  const onBoadingState = await getUserOnboardingState();
  if (!onBoadingState.ok) {
    throw new Error("");
  }

  if (!onBoadingState.hasPlaidItems) {
    return (
      <Link
        href="/connect-bank"
        className="btn btn-primary
  "
      >
        {button.buttonText}
      </Link>
    );
  } else {
    return (
      <Link
        href="/dashboard"
        className="btn btn-primary
  "
      >
        {button.buttonText}
      </Link>
    );
  }
}

export default GetStartedButton;
