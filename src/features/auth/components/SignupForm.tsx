"use client";

import { createClient } from "@/lib/supabase/browser";
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
      <div>{signupError && <p>{signupError}</p>}</div>
      <button type="submit">Submit</button>
    </form>
  );
}
