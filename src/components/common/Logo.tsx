import { Landmark } from "lucide-react";

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <Landmark />
      <span className="text-2xl font-extrabold tracking-tighter text-on-surface">
        Obsidian Ledger
      </span>
    </div>
  );
}

export default Logo;
