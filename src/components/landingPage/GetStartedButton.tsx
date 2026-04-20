import Link from "next/link";

type props = { button: { buttonText: string } };

function GetStartedButton({ button }: props) {
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

export default GetStartedButton;
