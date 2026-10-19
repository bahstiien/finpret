import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

/** Retour du lien magique et des fournisseurs OAuth : ouvre la session puis redirige. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    const [pathname, query] = next.split("?");
    target.pathname = pathname ?? "/app";
    if (query) target.search = `?${query}`;
  } else {
    target.pathname = "/login";
    target.searchParams.set("error", "link");
    target.searchParams.set("next", next);
  }
  return NextResponse.redirect(target);
}
