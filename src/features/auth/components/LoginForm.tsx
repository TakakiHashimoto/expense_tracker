"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getUserOnboardingState } from "../actions";

export default function LoginForm() {
  const supabase = createClient();
  const router = useRouter();

  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      // console.log(error.code); // invalid_credentials
      // console.log(error.message); // Invalid login credentials
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
    <form onSubmit={handleSubmit}>
      <div>
        {/* email section*/}
        <label>Email:</label>
        <input
          type="email"
          name="email"
          id="email"
          placeholder="example@email.com"
        />
      </div>
      <div>
        {/* password section */}
        <label>Password:</label>
        <input type="password" id="password" name="password" />
      </div>
      <div aria-live="polite" aria-atomic="true">
        {loginError && <p>{loginError}</p>}
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}

// this is formdata object that looks something like the following
// FormData
// [[Prototype]]:FormData append: ƒ append() delete: ƒ delete() entries:ƒ entries() forEach:ƒ forEach() get:
// ƒ () getAll: ƒ getAll() has:ƒ has() keys:ƒ keys() set:ƒ () values:ƒ values() constructor:ƒ FormData()
// Symbol(Symbol.iterator): ƒ e`ntries() Symbol(Symbol.toStringTag): "FormData" [[Prototype]]:Object
