// 1. reads query params
// 2. exchanges the auth code for a session
// 3. sets cookies
// 4. redirects

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // creating url object so that it is easier to manipulate
  // request.url === "http://localhost:3000/auth/confirm?code=abc123&next=/connect-bank"
  const url = new URL(request.url);
  const code = url.searchParams.get("code"); // code is needed to exchange with sesstion
  const next = url.searchParams.get("next") ?? "/connect-bank"; // ?? means if the leftside is null, returns right side.

  console.log(code, next);
  const safeUrl =
    next.startsWith("/") && !next.startsWith("//") ? next : "/connect-bank";

  // if code is not provided, can't exchange for session, thus safe escape
  // url.origin = protocol + // + host (+ port) ex) http://localhost:3000
  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_code`, url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=confirm_failed`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(safeUrl, url.origin));
}
