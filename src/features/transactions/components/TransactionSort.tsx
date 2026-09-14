"use client";
import { usePathname, useSearchParams } from "next/navigation";
import type { TransactionSort } from "../types";
import Link from "next/link";
import { MoveDown, MoveUp } from "lucide-react";

const activeFilterClass = "bg-surface-container-highest text-primary shadow-lg";
const inactiveFilterClass = "text-on-surface-variant hover:text-on-surface";

function buildHref({
  pathname,
  searchParams,
  sort,
}: {
  pathname: string;
  searchParams: URLSearchParams;
  sort: TransactionSort;
}) {
  const params = new URLSearchParams(searchParams);
  params.delete("page");
  params.set("sort", sort);

  const queryString = params.toString();

  return queryString ? `${pathname}?${params.toString()}` : pathname;
}

function TransactionSort({ sort }: { sort: TransactionSort }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="grid w-full grid-cols-2 gap-2 bg-surface-container-low p-1.5 rounded-xl sm:flex sm:w-auto sm:items-center sm:justify-around">
      <Link
        href={buildHref({ pathname, searchParams, sort: "date_desc" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${sort === "date_desc" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        Newest
      </Link>
      <Link
        href={buildHref({ pathname, searchParams, sort: "date_asc" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${sort === "date_asc" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        Oldest
      </Link>
      <Link
        href={buildHref({ pathname, searchParams, sort: "amount_asc" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${sort === "amount_asc" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        <span className="flex items-center justify-start">
          Amount <MoveUp />
        </span>
      </Link>
      <Link
        href={buildHref({ pathname, searchParams, sort: "amount_desc" })}
        className={`px-2 lg:px-6 py-2 rounded-lg text-sm font-semibold ${sort === "amount_desc" ? activeFilterClass : inactiveFilterClass} transition-all`}
      >
        <span className="flex items-center justify-start">
          Amount <MoveDown />
        </span>
      </Link>
    </div>
  );
}

export default TransactionSort;
