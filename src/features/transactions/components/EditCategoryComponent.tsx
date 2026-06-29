"use client";

import { useState } from "react";

export type CategoryType = {
  id: string;
  name: string;
  kind: "expense" | "income";
};

type Props = {
  categories: CategoryType[];
  initialCetegId: string;
  changeCategory: (id: string | null) => void;
  isUpdating: boolean;
};

function EditCategoryComponent({
  categories,
  initialCetegId,
  changeCategory,
  isUpdating,
}: Props) {
  const [selectedCategId, setSelectedCategId] = useState<string>(
    initialCetegId ?? "",
  );

  return (
    <div className="pt-4 border-t border-surface-variant/30">
      <div className="relative group/select">
        <select
          className="w-full bg-surface-container-low text-on-surface border-none rounded-xl py-3 px-4 appearance-none focus:ring-2 focus:ring-primary transition-all duration-200 font-medium text-sm cursor-pointer"
          onChange={(e) => setSelectedCategId(e.target.value)}
          value={selectedCategId}
        >
          {categories.map((categ) => (
            <option key={categ.id} value={categ.id}>
              {categ.name}
            </option>
          ))}
          <option value="">Uncategorized</option>
        </select>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
          expand_more
        </span>
      </div>
      <button
        className="mt-4 w-full py-2 px-4 rounded-xl bg-linear-to-r from-primary to-primary-container text-on-primary font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity shadow-lg"
        type="button"
        onClick={() =>
          changeCategory(selectedCategId === "" ? null : selectedCategId)
        }
        disabled={isUpdating}
      >
        Save Category
      </button>
    </div>
  );
}

export default EditCategoryComponent;
