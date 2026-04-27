// this page is for each recent transaction item, such "starbuck foods -$4"

// how to get category ?

type RecentTransactionItemPorp = {
  shop: string;
  category: string;
  date: string;
  amount: string;
};

function RecentTransactionItem({
  shop,
  category,
  date,
  amount,
}: RecentTransactionItemPorp) {
  return (
    <div className="flex justify-between">
      <div className="flex flex-col ">
        <h2>{shop}</h2>
        <p>
          <span>{category}</span>•<span>{date}</span>
        </p>
      </div>
      <div>
        <p>{amount}</p>
      </div>
    </div>
  );
}

export default RecentTransactionItem;
