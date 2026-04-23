"use client";

import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupForm() {
  const router = useRouter();
  const [signupError, setSignUpError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSignUpError(null); // on every submiit erros is reset
    const signupData = new FormData(e.currentTarget);
    const email = String(signupData.get("email") ?? "").trim();
    const password = String(signupData.get("password") ?? "");
    const data = {
      email: email,
      password: password,
      options: { emailRedirectTo: "http://localhost:3002/auth/confirm" },
    };
    // Until the user clicks the link in that email, their session will be null.

    const { error } = await supabase.auth.signUp(data);
    if (error) {
      // if the user is already in the database, redirect them to login page
      console.log(error);
      setSignUpError(error.message);
      return;
    }

    // on success, redirect to "confirm your email page" page
    // storing data in sessionStorage so that you can use the email for resending verify email
    sessionStorage.setItem("email", email);
    router.push("/verify-email");
  }

  return (
    <div className="min-h-screen flex w-full">
      <section className="hidden lg:flex lg:w-7/12 relative bg-surface-container-lowest items-center justify-center p-10 overflow-hidden">
        <div className="absolute inset-0 bg-auth-pattern opacity-40"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full"></div>
        </div>
        <div className="relative z-10 max-w-xl">
          <div className="mb-12 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
              <span
                className="material-symbols-outlined text-on-primary text-3xl"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                account_balance
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface">
              Obsidian Ledger
            </h1>
          </div>
          <div className="space-y-12">
            <div className="group">
              <h2 className="text-4xl font-bold tracking-tight text-on-surface mb-6 leading-tight">
                Precision management for{" "}
                <span className="text-primary">refined wealth.</span>
              </h2>
              <p className="text-lg text-on-surface-variant leading-relaxed max-w-md">
                Experience a higher standard of financial oversight. Quiet
                Authority brings editorial precision to your personal expenses.
              </p>
            </div>
            <div className="grid gap-6">
              <div className="flex gap-4 items-start p-6 rounded-2xl bg-surface-container-low transition-colors hover:bg-surface-container">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">
                    query_stats
                  </span>
                </div>
                <div>
                  <h3 className="text-on-surface font-semibold mb-1">
                    Architectural Insights
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Advanced visualization of capital flow without the noise of
                    traditional trackers.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start p-6 rounded-2xl bg-surface-container-low transition-colors hover:bg-surface-container">
                <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-secondary text-xl">
                    shield
                  </span>
                </div>
                <div>
                  <h3 className="text-on-surface font-semibold mb-1">
                    Institutional Security
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    Bank-grade encryption protecting your most sensitive
                    financial declarations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full lg:w-5/12 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md bg-surface-container-low p-10 lg:p-12 rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.4)]">
          <h2 className="text-3xl font-extrabold tracking-tight mb-2">
            Create your account
          </h2>
          <p className="text-on-surface-variant mb-10">
            Sign up to start tracking your finances.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1"
                htmlFor="email"
              >
                Email Address
              </label>
              <input
                type="email"
                name="email"
                id="email"
                placeholder="example@email.com"
                className="w-full bg-surface-container-lowest border-none rounded-xl p-4 text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
              />
            </div>
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1"
                htmlFor="password"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full bg-surface-container-lowest border-none rounded-xl p-4 text-on-surface placeholder:text-outline/40 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
              />
            </div>
            <div aria-live="polite" aria-atomic="true">
              {signupError && <p>{signupError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-linear-to-r from-primary to-primary-container text-on-primary font-bold py-4 rounded-xl shadow-lg shadow-primary/10 active:scale-[0.98] transition-all hover:brightness-110"
            >
              Sign Up
            </button>
          </form>
          <div className="mt-8 pt-8 border-t border-outline-variant/15 text-center">
            <p className="text-on-surface-variant text-sm">
              Already have an account?
              <Link
                href="/login"
                className="text-primary font-bold ml-1 hover:underline underline-offset-4"
              >
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
