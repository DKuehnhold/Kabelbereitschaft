import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // ignorieren – Ziel ist ohnehin die Abmeldung/Weiterleitung.
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
