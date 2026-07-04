import { EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import ConnectButtonComponent from "./ConnectButtonComponent";

export default function ConnectBank() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center ml-80">
      <section className="space-y-10">
        <div className="space-y-6">
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight text-on-surface">
            Connect your <br />
            <span className="text-primary-fixed-dim">Bank Account</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-lg leading-relaxed font-medium">
            Securely connect your account to automatically sync transactions and
            start tracking your spending with editorial precision.
          </p>
        </div>

        <ConnectButtonComponent title="Connect Bank" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <LockKeyhole className="material-symbols-outlined text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Secure connection
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <EyeOff className="material-symbols-outlined text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Read-only access
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
              <ShieldCheck className="material-symbols-outlined text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Private by design
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
