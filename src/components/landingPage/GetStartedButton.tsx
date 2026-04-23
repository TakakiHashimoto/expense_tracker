import { getUserOnboardingState } from "@/features/auth/actions";
import Link from "next/link";

type props = { button: { buttonText: string } };

async function GetStartedButton({ button }: props) {
  const onBoadingState = await getUserOnboardingState();

  if (!onBoadingState.ok) {
    return (
      <Link href="/login" className="btn btn-primary">
        {button.buttonText}
      </Link>
    );
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
  }

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

export default GetStartedButton;
