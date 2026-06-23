// 1. detect user input
// 2. based on the user input, generate url
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const { replace } = useRouter();

  const currentQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState<string>(currentQuery);

  function handleSearch(query: string) {
    const params = new URLSearchParams(searchParams);

    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }

    replace(`${pathName}?${params.toString()}`);
  }

  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    const setTimeoutId = setTimeout(() => {
      const trimmedQuery = query.trim();

      if (trimmedQuery === currentQuery) return;
      handleSearch(query);
    }, 400);

    return () => window.clearTimeout(setTimeoutId);
  }, [query, searchParams, pathName, replace]);

  return (
    <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-2 rounded-xl w-full max-w-md transition-all focus-within:bg-surface-container-low group">
      <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">
        search
      </span>
      <input
        className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full placeholder:text-on-surface-variant/40"
        placeholder={placeholder}
        type="text"
        onChange={(e) => setQuery(e.target.value)}
        value={query}
      />
    </div>
  );
}

export default Search;
