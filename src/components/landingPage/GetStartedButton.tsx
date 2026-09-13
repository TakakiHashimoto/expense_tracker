import { getUserOnboardingState } from "@/features/auth/actions";
import Link from "next/link";

async function GetStartedButton() {
  const onBoardingState = await getUserOnboardingState();

  if (!onBoardingState.ok) {
    return (
      <Link href="/login" className="btn btn-primary mx-3">
        Try BankOS
      </Link>
    );
  }

  if (!onBoardingState.hasPlaidItems) {
    return (
      <Link href="/connect-bank" className="btn btn-primary mx-3">
        Connect a sandbox bank
      </Link>
    );
  }

  return (
    <Link href="/dashboard" className="btn btn-primary mx-3">
      Open dashboard
    </Link>
  );
}

export default GetStartedButton;
