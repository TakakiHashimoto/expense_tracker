// 1. detect user input
// 2. based on the user input, generate url
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

function Search({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const { replace } = useRouter();

  const currentQuery = searchParams.get("q") ?? "";
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams);

      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }

      replace(`${pathName}?${params.toString()}`);
    },
    [searchParams, pathName, replace],
  );

  const handleChange = useCallback(
    (nextQuery: string) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const trimmedQuery = nextQuery.trim();

        if (trimmedQuery === currentQuery) return;
        handleSearch(nextQuery);
      }, 400);
    },
    [currentQuery, handleSearch],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-4 bg-surface-container-lowest shadow-lg px-4 py-2 rounded-xl w-full max-w-md transition-all focus-within:bg-surface-container-low group">
      <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">
        search
      </span>
      <input
        className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full placeholder:text-on-surface-variant/40"
        placeholder={placeholder}
        type="text"
        onChange={(e) => handleChange(e.target.value)}
        defaultValue={currentQuery}
        key={currentQuery}
      />
    </div>
  );
}

export default Search;
