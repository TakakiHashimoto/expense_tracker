"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyEmail() {
  const supabase = createClient();
  const router = useRouter();
  const [resendError, setResendError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  async function handleClick() {
    // resend supabase confirmation
    const email = sessionStorage.getItem("email") ?? "";
    setResendError(null);
    setSuccessMsg(null);

    if (!email) {
      setResendError("Email is not provided. Redirecting to signup page");
      setTimeout(() => router.push("/signup"), 3000);
      return;
    }
    setIsSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setResendError(error.message);
      setIsSending(false);
      return;
    }

    setSuccessMsg("Successfully Resent");
    setTimeout(() => setIsSending(false), 60000);
  }
  return (
    <div>
      <p>We have sent you a verify email</p>
      <p>Please check your email</p>
      <button
        onClick={handleClick}
        className="text-blue-500/40"
        disabled={isSending}
      >
        Resend confirmation email
      </button>
      {resendError && <p>{resendError}</p>}
      {successMsg && <p>{successMsg}</p>}
    </div>
  );
}
