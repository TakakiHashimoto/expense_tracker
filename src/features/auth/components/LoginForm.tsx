"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getUserOnboardingState } from "../actions";
import Logo from "@/components/common/Logo";
import Link from "next/link";

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();

  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const typedData = new FormData(e.currentTarget);
    // const formData = Object.fromEntries(loginData.entries());
    // It’s fine for logging/debugging, but for typed APIs it often causes some issues
    // {email: 'takaki@email.com', password: 'takaki'}

    const loginData = {
      email: String(typedData.get("email") ?? "").trim(),
      password: String(typedData.get("password")),
    };

    const { error } = await supabase.auth.signInWithPassword(loginData);
    if (error) {
      console.error("Sign in failed", error);
      setLoginError(error.message);
      return;
    }

    // get plaid item for this user
    // If empty, redirect to "connect-bank",
    // If they already have items, redirect to dashboard
    const onBoadingState = await getUserOnboardingState();
    if (!onBoadingState.ok) {
      setLoginError("Server Error");
      return;
    }

    if (!onBoadingState.hasPlaidItems) {
      router.push("/connect-bank");
    } else {
      // In client side, router.push() is the Nextjs way to redirect
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex w-full">
      <section className="hidden lg:flex lg:w-7/12 flex-col p-16 relative overflow-hidden bg-surface-container-lowest">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-125 h-125 bg-secondary/5 blur-[160px] rounded-full"></div>
        <header className="relative z-10">
          <Logo />
        </header>
        <div className="relative z-10 max-w-xl">
          <h1 className="text-5xl mt-3 font-extrabold tracking-tight leading-[1.1] mb-8 bg-linear-to-br from-on-surface to-on-surface-variant bg-clip-text text-transparent">
            Understand your money with clarity
          </h1>
          <ul className="space-y-6 mb-12">
            <li className="flex items-start gap-4">
              <div className="mt-1 shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">
                  check
                </span>
              </div>
              <div>
                <p className="font-bold text-on-surface">Secure bank sync</p>
                <p className="text-on-surface-variant text-sm mt-1">
                  Institutional-grade encryption for all your financial
                  accounts.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="mt-1 shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">
                  check
                </span>
              </div>
              <div>
                <p className="font-bold text-on-surface">
                  Monthly spending insights
                </p>
                <p className="text-on-surface-variant text-sm mt-1">
                  Automatic categorization of every dollar you spend.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="mt-1 shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">
                  check
                </span>
              </div>
              <div>
                <p className="font-bold text-on-surface">No manualy typing</p>
                <p className="text-on-surface-variant text-sm mt-1">
                  Securely reflects your spendings.
                </p>
              </div>
            </li>
          </ul>
          {/* <DashboardMock /> */}
        </div>
      </section>
      {/* right side: login form */}
      <section className="w-full lg:w-5/12 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md bg-surface-container-low p-10 lg:p-12 rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.4)]">
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">
            Welcome back
          </h2>
          <p className="text-on-surface-variant mb-10">
            Log in to continue tracking your finances.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="group">
              <label
                className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                className="w-full bg-surface-container-lowest border-none rounded-xl p-4 text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                type="email"
                name="email"
                id="email"
                placeholder="example@email.com"
              />
            </div>
            <div>
              {/* password section */}
              <label
                className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                htmlFor="password"
              >
                Password:
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full bg-surface-container-lowest border-none rounded-xl p-4 text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
              />
            </div>
            <div aria-live="polite" aria-atomic="true">
              {loginError && <p className="text-tertiary">{loginError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-linear-to-r from-primary to-primary-container text-on-primary font-bold py-4 rounded-xl shadow-lg shadow-primary/10 active:scale-[0.98] transition-all hover:brightness-110"
            >
              Login
            </button>
          </form>
          <div className="mt-8 pt-8 border-t border-outline-variant/15 text-center">
            <p className="text-on-surface-variant text-sm">
              Don&apos;t have an account?
              <Link
                href="/signup"
                className="text-primary font-bold ml-1 hover:underline underline-offset-4"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// this is formdata object that looks something like the following
// FormData
// [[Prototype]]:FormData append: ƒ append() delete: ƒ delete() entries:ƒ entries() forEach:ƒ forEach() get:
// ƒ () getAll: ƒ getAll() has:ƒ has() keys:ƒ keys() set:ƒ () values:ƒ values() constructor:ƒ FormData()
// Symbol(Symbol.iterator): ƒ e`ntries() Symbol(Symbol.toStringTag): "FormData" [[Prototype]]:Object
