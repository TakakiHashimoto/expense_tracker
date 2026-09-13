"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { TransactionTypeFilter } from "../types";

const activeFilterClass = "bg-surface-container-highest text-primary shadow-lg";
const inactiveFilterClass = "text-on-surface-variant hover:text-on-surface";

type Props = { filterType: TransactionTypeFilter };

function buildHref({
  pathname,
  searchParams,
  type,
}: {
  pathname: string;
  searchParams: URLSearchParams;
  type: TransactionTypeFilter;
}) {
  const params = new URLSearchParams(searchParams);

  if (type === "all") {
    params.delete("type");
  } else {
    params.set("type", type);
  }

  const queryString = params.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

function TransactionTypeFilter({ filterType }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  return (
    <div className="grid w-full grid-cols-2 gap-2 bg-surface-container-low p-1.5 rounded-xl sm:flex sm:w-auto sm:items-center sm:justify-around">
      <Link
        href={buildHref({ pathname, searchParams, type: "all" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${filterType === "all" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        All
      </Link>
      <Link
        href={buildHref({ pathname, searchParams, type: "income" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${filterType === "income" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        Income
      </Link>
      <Link
        href={buildHref({ pathname, searchParams, type: "expense" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${filterType === "expense" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        Expenses
      </Link>
      <Link
        href={buildHref({ pathname, searchParams, type: "uncategorized" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${filterType === "uncategorized" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        Uncategorized
      </Link>
    </div>
  );
}

export default TransactionTypeFilter;
