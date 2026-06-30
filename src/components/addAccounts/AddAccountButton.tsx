// 1. user clicks the button => generate link_token
// 2. with this link_token, opens the update portal
// 3. onSuccess, sync accounts to my database
// 4. refresh the page (/accounts, /dashboard)

type Props = { plaidItemUuid: string };

function AddAccountButton({ plaidItemUuid }: Props) {
  async function obtainLinkToken(plaidItemUuid: string) {}
  return (
    <div>
      <button className="btn-primary">Add Account</button>
    </div>
  );
}

export default AddAccountButton;
